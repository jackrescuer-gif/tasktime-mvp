import { prisma } from '../../prisma/client.js';
import { getCachedJson, setCachedJson } from '../../shared/redis.js';

type AdminStats = {
  counts: {
    users: number;
    projects: number;
    issues: number;
    timeLogs: number;
  };
  issuesByStatus: Array<{ status: string; _count: { _all: number } }>;
  issuesByAssignee: Array<{ assigneeId: string | null; _count: { _all: number } }>;
  recentActivity: Awaited<ReturnType<typeof getActivity>>;
};

export async function getStats() {
  const cacheKey = 'admin:stats';
  const cached = await getCachedJson<AdminStats>(cacheKey);
  if (cached) {
    return cached;
  }

  const [users, projects, issues, timeLogs] = await Promise.all([
    prisma.user.count(),
    prisma.project.count(),
    prisma.issue.count(),
    prisma.timeLog.count(),
  ]);

  const issuesByStatus = await prisma.issue.groupBy({
    by: ['status'],
    _count: { _all: true },
  });

  const issuesByAssignee = await prisma.issue.groupBy({
    by: ['assigneeId'],
    _count: { _all: true },
    where: { assigneeId: { not: null } },
  });

  const recentActivity = await getActivity();

  const stats: AdminStats = {
    counts: { users, projects, issues, timeLogs },
    issuesByStatus,
    issuesByAssignee,
    recentActivity,
  };

  await setCachedJson(cacheKey, stats);

  return stats;
}

export async function listUsersWithMeta() {
  const users = await prisma.user.findMany({
    orderBy: { createdAt: 'desc' },
    select: {
      id: true,
      email: true,
      name: true,
      role: true,
      isActive: true,
      createdAt: true,
      _count: {
        select: {
          createdIssues: true,
          assignedIssues: true,
          timeLogs: true,
        },
      },
    },
  });

  return users;
}

export async function getActivity() {
  return prisma.auditLog.findMany({
    orderBy: { createdAt: 'desc' },
    take: 50,
    include: { user: { select: { id: true, name: true, email: true } } },
  });
}

export async function getIssuesByStatusReport(params: {
  projectId: string;
  sprintId?: string;
  from?: string;
  to?: string;
}) {
  const where: any = { projectId: params.projectId };
  if (params.sprintId) {
    where.sprintId = params.sprintId;
  }
  if (params.from || params.to) {
    where.createdAt = {};
    if (params.from) where.createdAt.gte = new Date(params.from);
    if (params.to) where.createdAt.lte = new Date(params.to);
  }

  const cacheKey = `admin:report:issuesByStatus:${params.projectId}:${params.sprintId ?? 'all'}:${params.from ?? 'none'}:${
    params.to ?? 'none'
  }`;

  const cached = await getCachedJson<unknown[]>(cacheKey);
  if (cached) {
    return cached;
  }

  const data = await prisma.issue.groupBy({
    by: ['status'],
    _count: { _all: true },
    where,
  });

  await setCachedJson(cacheKey, data);

  return data;
}

export async function getIssuesByAssigneeReport(params: {
  projectId: string;
  sprintId?: string;
  from?: string;
  to?: string;
}) {
  const where: any = { projectId: params.projectId };
  if (params.sprintId) {
    where.sprintId = params.sprintId;
  }
  if (params.from || params.to) {
    where.createdAt = {};
    if (params.from) where.createdAt.gte = new Date(params.from);
    if (params.to) where.createdAt.lte = new Date(params.to);
  }

  const cacheKey = `admin:report:issuesByAssignee:${params.projectId}:${params.sprintId ?? 'all'}:${params.from ?? 'none'}:${
    params.to ?? 'none'
  }`;

  const cached = await getCachedJson<unknown[]>(cacheKey);
  if (cached) {
    return cached;
  }

  const data = await prisma.issue.groupBy({
    by: ['assigneeId'],
    _count: { _all: true },
    where,
  });

  await setCachedJson(cacheKey, data);

  return data;
}

