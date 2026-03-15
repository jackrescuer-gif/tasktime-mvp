import { prisma } from '../../../prisma/client.js';
import { AppError } from '../../../shared/middleware/error-handler.js';
import type { IssueStatus } from '@prisma/client';

// Extract issue keys like PROJ-42 from commit messages / MR titles
export function extractIssueKeys(text: string): string[] {
  const matches = text.match(/\b([A-Z][A-Z0-9]+-\d+)\b/g);
  return matches ? [...new Set(matches)] : [];
}

export async function configure(
  projectId: string,
  data: { gitlabUrl: string; gitlabToken: string; webhookToken: string },
) {
  return prisma.gitLabIntegration.upsert({
    where: { projectId },
    create: { projectId, ...data, active: true },
    update: { ...data, active: true },
  });
}

export async function getIntegration(projectId: string) {
  return prisma.gitLabIntegration.findUnique({ where: { projectId } });
}

export async function listIntegrations() {
  return prisma.gitLabIntegration.findMany({
    include: { project: { select: { id: true, name: true, key: true } } },
  });
}

// Main webhook handler
export async function handleWebhook(payload: Record<string, unknown>): Promise<void> {
  const objectKind = payload['object_kind'] as string | undefined;

  if (objectKind === 'push') {
    await handlePush(payload);
  } else if (objectKind === 'merge_request') {
    await handleMergeRequest(payload);
  }
  // Other event types (pipeline, tag_push) — ignore for MVP
}

async function handlePush(payload: Record<string, unknown>): Promise<void> {
  const commits = (payload['commits'] as Array<{ message: string }> | undefined) ?? [];
  const keys = commits.flatMap((c) => extractIssueKeys(c.message));
  if (keys.length === 0) return;
  await updateIssuesByKeys(keys, 'IN_PROGRESS');
}

async function handleMergeRequest(payload: Record<string, unknown>): Promise<void> {
  const attrs = payload['object_attributes'] as Record<string, unknown> | undefined;
  if (!attrs) return;

  const title = (attrs['title'] as string) ?? '';
  const description = (attrs['description'] as string) ?? '';
  const state = attrs['state'] as string | undefined;
  const action = attrs['action'] as string | undefined;

  const keys = [
    ...extractIssueKeys(title),
    ...extractIssueKeys(description),
  ];
  if (keys.length === 0) return;

  let status: IssueStatus | null = null;

  if (action === 'open' || state === 'opened') {
    status = 'IN_PROGRESS';
  } else if (action === 'merge' || state === 'merged') {
    status = 'REVIEW';
  } else if (action === 'close' || state === 'closed') {
    status = 'DONE';
  }

  if (!status) return;
  await updateIssuesByKeys(keys, status);
}

async function updateIssuesByKeys(keys: string[], status: IssueStatus): Promise<void> {
  for (const key of keys) {
    // key format: PROJ-42
    const dashIdx = key.lastIndexOf('-');
    if (dashIdx < 0) continue;
    const projectKey = key.slice(0, dashIdx);
    const number = parseInt(key.slice(dashIdx + 1), 10);
    if (isNaN(number)) continue;

    await prisma.issue.updateMany({
      where: {
        number,
        project: { key: projectKey },
        // Don't downgrade DONE/CANCELLED
        status: { notIn: ['DONE', 'CANCELLED'] },
      },
      data: { status },
    });
  }
}

export async function deactivate(projectId: string) {
  const existing = await prisma.gitLabIntegration.findUnique({ where: { projectId } });
  if (!existing) throw new AppError(404, 'GitLab integration not found');
  return prisma.gitLabIntegration.update({ where: { projectId }, data: { active: false } });
}
