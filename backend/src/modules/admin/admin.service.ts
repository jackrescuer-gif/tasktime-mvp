import { prisma } from '../../prisma/client.js';

export async function getStats() {
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

  const recentActivity = await prisma.auditLog.findMany({
    orderBy: { createdAt: 'desc' },
    take: 50,
    include: { user: { select: { id: true, name: true, email: true } } },
  });

  return {
    counts: { users, projects, issues, timeLogs },
    issuesByStatus,
    issuesByAssignee,
    recentActivity,
  };
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

