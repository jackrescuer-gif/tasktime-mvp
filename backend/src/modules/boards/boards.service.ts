import { prisma } from '../../prisma/client.js';
import { AppError } from '../../shared/middleware/error-handler.js';
import { getCachedJson, setCachedJson, deleteCachedJson } from '../../shared/redis.js';

const BOARD_CACHE_TTL = 30; // seconds

function boardCacheKey(projectId: string, sprintId?: string): string {
  return `board:${projectId}:${sprintId ?? 'all'}`;
}

export async function invalidateBoardCache(projectId: string, sprintId?: string): Promise<void> {
  await deleteCachedJson(boardCacheKey(projectId, sprintId));
  await deleteCachedJson(boardCacheKey(projectId)); // also invalidate "all" key
}

export async function getBoard(projectId: string, sprintId?: string) {
  const cacheKey = boardCacheKey(projectId, sprintId);
  const cached = await getCachedJson<ReturnType<typeof buildBoard>>(cacheKey);
  if (cached) return cached;

  const project = await prisma.project.findUnique({ where: { id: projectId } });
  if (!project) throw new AppError(404, 'Project not found');

  const where: Record<string, unknown> = { projectId };
  if (sprintId) where.sprintId = sprintId;

  const issues = await prisma.issue.findMany({
    where,
    include: {
      assignee: { select: { id: true, name: true } },
      _count: { select: { children: true, comments: true } },
    },
    orderBy: [{ orderIndex: 'asc' }, { createdAt: 'asc' }],
  });

  const result = buildBoard(projectId, sprintId, issues);
  await setCachedJson(cacheKey, result, BOARD_CACHE_TTL);
  return result;
}

function buildBoard(projectId: string, sprintId: string | undefined, issues: Awaited<ReturnType<typeof prisma.issue.findMany>>) {
  const columns: Record<string, typeof issues> = {
    OPEN: [],
    IN_PROGRESS: [],
    REVIEW: [],
    DONE: [],
    CANCELLED: [],
  };
  for (const issue of issues) {
    columns[issue.status]?.push(issue);
  }
  return { projectId, sprintId: sprintId ?? null, columns };
}

type ReorderUpdate = { id: string; status: string; orderIndex: number };

export async function reorderIssues(updates: ReorderUpdate[], projectId?: string) {
  await prisma.$transaction(
    updates.map((u) =>
      prisma.issue.update({
        where: { id: u.id },
        data: { status: u.status as never, orderIndex: u.orderIndex },
      })
    )
  );
  if (projectId) {
    await invalidateBoardCache(projectId);
  }
}
