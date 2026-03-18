import Anthropic from '@anthropic-ai/sdk';
import { prisma } from '../../prisma/client.js';
import { AppError } from '../../shared/middleware/error-handler.js';
import * as issuesService from '../issues/issues.service.js';
import type { AiEstimateDto, AiDecomposeDto } from './ai.dto.js';

const anthropic = process.env.ANTHROPIC_API_KEY
  ? new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY })
  : null;

const MIN_ESTIMATE_HOURS = 0.5;
const MAX_ESTIMATE_HOURS = 40;
const BASE_HOURS = 1;
const HOURS_PER_1000_CHARS = 0.5;

async function resolveIssueId(dto: { issueId?: string; issueKey?: string }): Promise<string> {
  if (dto.issueId) return dto.issueId;
  if (dto.issueKey) {
    const issue = await issuesService.getIssueByKey(dto.issueKey);
    return issue.id;
  }
  throw new AppError(400, 'Either issueId or issueKey is required');
}

function setAiStatus(issueId: string, status: 'IN_PROGRESS' | 'DONE' | 'FAILED'): Promise<unknown> {
  return prisma.issue.update({
    where: { id: issueId },
    data: { aiExecutionStatus: status },
  });
}

/**
 * Heuristic AI estimate: base + length-based component, capped.
 * MVP: no external LLM; replace with real model later.
 */
function computeEstimateHours(title: string, description: string | null): number {
  const text = `${title}\n${description ?? ''}`.trim();
  const len = text.length;
  const extra = (len / 1000) * HOURS_PER_1000_CHARS;
  const raw = BASE_HOURS + extra;
  const clamped = Math.min(MAX_ESTIMATE_HOURS, Math.max(MIN_ESTIMATE_HOURS, Math.round(raw * 2) / 2));
  return clamped;
}

export async function estimateIssue(dto: AiEstimateDto) {
  const issueId = await resolveIssueId(dto);

  await setAiStatus(issueId, 'IN_PROGRESS');

  try {
    const issue = await prisma.issue.findUnique({
      where: { id: issueId },
      select: { id: true, title: true, description: true, projectId: true },
    });
    if (!issue) throw new AppError(404, 'Issue not found');

    const estimatedHours = computeEstimateHours(issue.title, issue.description);

    await prisma.issue.update({
      where: { id: issue.id },
      data: { estimatedHours },
    });

    await setAiStatus(issueId, 'DONE');

    return {
      issueId: issue.id,
      estimatedHours,
    };
  } catch (err) {
    await setAiStatus(issueId, 'FAILED').catch(() => {});
    throw err;
  }
}

/**
 * Decompose an issue into subtasks using Claude AI.
 * Falls back to a capped heuristic if no API key is configured.
 */
async function generateSubtasks(
  title: string,
  description: string | null,
  issueType: string,
): Promise<string[]> {
  if (anthropic) {
    return decomposeWithClaude(title, description, issueType);
  }
  return decomposeHeuristic(description);
}

async function decomposeWithClaude(
  title: string,
  description: string | null,
  issueType: string,
): Promise<string[]> {
  const descSection = description?.trim()
    ? `\nОписание:\n${description.trim()}`
    : '';

  const message = await anthropic!.messages.create({
    model: 'claude-haiku-4-5',
    max_tokens: 1024,
    messages: [
      {
        role: 'user',
        content: `Ты — опытный проджект-менеджер. Декомпозируй задачу типа ${issueType} на конкретные подзадачи.

Задача: ${title}${descSection}

Требования:
- Верни от 3 до 8 подзадач
- Каждая подзадача — конкретный, самостоятельный блок работы
- Группируй по смыслу (анализ, проектирование, реализация, тестирование и т.д.)
- Не дроби текст механически — думай о сути работы
- Заголовок каждой подзадачи до 120 символов
- Ответ — ТОЛЬКО JSON-массив строк, без пояснений

Пример: ["Проанализировать требования", "Спроектировать схему БД", "Реализовать API", "Написать тесты", "Обновить документацию"]`,
      },
    ],
  });

  const text = message.content.find((b) => b.type === 'text')?.text ?? '';

  // Strip markdown code fences if present
  const cleaned = text.replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/, '').trim();

  const parsed: unknown = JSON.parse(cleaned);
  if (Array.isArray(parsed) && parsed.every((t) => typeof t === 'string')) {
    return (parsed as string[]).filter((t) => t.trim().length > 0).slice(0, 10);
  }
  throw new Error('Unexpected response format from Claude');
}

/**
 * Heuristic fallback when no API key is set.
 * Extracts bullet/numbered list items from description, capped at 10.
 */
function decomposeHeuristic(description: string | null): string[] {
  if (!description?.trim()) return [];
  const bullets: string[] = [];
  for (const raw of description.split(/\r?\n/)) {
    const line = raw.trim();
    const m = line.match(/^[-*•]\s+(.+)/) ?? line.match(/^\d+[.)]\s+(.+)/);
    if (m) bullets.push(m[1].trim());
  }
  // Cap at 10 so we never create 64 subtasks from a wall of text
  return bullets.slice(0, 10);
}

export async function decomposeIssue(dto: AiDecomposeDto, creatorId: string) {
  const issueId = await resolveIssueId(dto);

  await setAiStatus(issueId, 'IN_PROGRESS');

  try {
    const issue = await prisma.issue.findUnique({
      where: { id: issueId },
      select: { id: true, projectId: true, title: true, description: true, type: true },
    });
    if (!issue) throw new AppError(404, 'Issue not found');

    const allowedParents = ['EPIC', 'STORY', 'TASK'];
    if (!allowedParents.includes(issue.type)) {
      throw new AppError(400, `Issue type ${issue.type} cannot be decomposed into subtasks`);
    }

    const titles = await generateSubtasks(issue.title, issue.description, issue.type);
    const subtaskTitles = titles.length > 0 ? titles : ['Уточнить требования и план реализации'];

    const created: Array<{ id: string; title: string; type: string; number: number }> = [];

    for (const title of subtaskTitles) {
      const child = await issuesService.createIssue(issue.projectId, creatorId, {
        title: title.slice(0, 500),
        description: undefined,
        type: 'SUBTASK',
        priority: 'MEDIUM',
        parentId: issue.id,
      });
      created.push({
        id: child.id,
        title: child.title,
        type: child.type,
        number: child.number,
      });
    }

    await setAiStatus(issueId, 'DONE');

    return {
      issueId: issue.id,
      createdCount: created.length,
      children: created,
    };
  } catch (err) {
    await setAiStatus(issueId, 'FAILED').catch(() => {});
    throw err;
  }
}
