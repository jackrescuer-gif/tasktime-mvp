import { Prisma } from '@prisma/client';
import { prisma } from '../../prisma/client.js';
import { AppError } from '../../shared/middleware/error-handler.js';
import type {
  OpenTasksQueryDto,
  UpdatePlanDto,
  UpdateDevResultDto,
  UpdateTestResultDto,
  AddDevLinkDto,
  UpdateExportAiStatusDto,
} from './export.dto.js';

// ===== Helpers =====

function toNumber(val: unknown): number {
  if (val == null) return 0;
  if (typeof val === 'number') return val;
  return Number(val);
}

function round(val: number, digits: number): number {
  const f = 10 ** digits;
  return Math.round(val * f) / f;
}

interface TimeBreakdown {
  humanHours: number;
  humanAiHours: number;
  agentHours: number;
  totalHours: number;
  agentCost: number;
  humanAiCost: number;
}

async function getIssueTimeBreakdown(issueId: string): Promise<TimeBreakdown> {
  const grouped = await prisma.timeLog.groupBy({
    by: ['source'],
    where: { issueId },
    _sum: { hours: true, costMoney: true },
  });

  const human = grouped.find((g) => g.source === 'HUMAN');
  const humanAi = grouped.find((g) => g.source === 'HUMAN_AI');
  const agent = grouped.find((g) => g.source === 'AGENT');

  const humanHours = round(toNumber(human?._sum.hours), 2);
  const humanAiHours = round(toNumber(humanAi?._sum.hours), 2);
  const agentHours = round(toNumber(agent?._sum.hours), 2);

  return {
    humanHours,
    humanAiHours,
    agentHours,
    totalHours: round(humanHours + humanAiHours + agentHours, 2),
    agentCost: round(toNumber(agent?._sum.costMoney), 4),
    humanAiCost: round(toNumber(humanAi?._sum.costMoney), 4),
  };
}

// ===== Open Tasks =====

export async function getOpenTasks(query: OpenTasksQueryDto) {
  const where: Prisma.IssueWhereInput = {
    status: { in: ['OPEN', 'IN_PROGRESS', 'REVIEW'] },
  };

  if (query.projectId) where.projectId = query.projectId;
  if (query.projectKey) where.project = { key: query.projectKey };
  if (query.onlyAiEligible) where.aiEligible = true;
  if (query.assigneeType) where.aiAssigneeType = query.assigneeType;
  if (query.type) where.type = query.type;
  if (query.priority) where.priority = query.priority;
  if (query.search) {
    where.OR = [
      { title: { contains: query.search, mode: 'insensitive' } },
      { description: { contains: query.search, mode: 'insensitive' } },
    ];
  }

  const issues = await prisma.issue.findMany({
    where,
    include: {
      project: { select: { id: true, name: true, key: true } },
      assignee: { select: { id: true, name: true, email: true } },
      creator: { select: { id: true, name: true } },
      parent: { select: { id: true, title: true, type: true, number: true } },
      children: { select: { id: true, title: true, type: true, status: true, number: true } },
      sprint: { select: { id: true, name: true, state: true } },
      _count: { select: { comments: true, timeLogs: true, devLinks: true } },
    },
    orderBy: [
      { priority: 'asc' }, // CRITICAL first (enum order)
      { status: 'asc' },
      { createdAt: 'asc' },
    ],
  });

  // Attach time breakdown per issue
  const tasksWithTime = await Promise.all(
    issues.map(async (issue) => {
      const timeBreakdown = await getIssueTimeBreakdown(issue.id);
      return {
        ...issue,
        timeBreakdown,
      };
    }),
  );

  return {
    tasks: tasksWithTime,
    meta: {
      total: tasksWithTime.length,
      filters: query,
    },
  };
}

// ===== Task Detail =====

export async function getOpenTaskDetail(id: string) {
  const issue = await prisma.issue.findUnique({
    where: { id },
    include: {
      project: { select: { id: true, name: true, key: true } },
      assignee: { select: { id: true, name: true, email: true } },
      creator: { select: { id: true, name: true } },
      parent: { select: { id: true, title: true, type: true, number: true } },
      children: { select: { id: true, title: true, type: true, status: true, number: true } },
      sprint: { select: { id: true, name: true, state: true } },
      comments: {
        include: { author: { select: { id: true, name: true } } },
        orderBy: { createdAt: 'desc' },
        take: 20,
      },
      devLinks: { orderBy: { createdAt: 'desc' } },
      _count: { select: { comments: true, timeLogs: true, devLinks: true } },
    },
  });

  if (!issue) throw new AppError(404, 'Issue not found');
  if (issue.status === 'DONE' || issue.status === 'CANCELLED') {
    throw new AppError(400, 'Issue is closed');
  }

  const timeBreakdown = await getIssueTimeBreakdown(issue.id);
  return { ...issue, timeBreakdown };
}

// ===== Task Time Summary =====

export async function getTaskTimeSummary(id: string) {
  const issue = await prisma.issue.findUnique({ where: { id }, select: { id: true } });
  if (!issue) throw new AppError(404, 'Issue not found');

  const breakdown = await getIssueTimeBreakdown(id);

  const recentLogs = await prisma.timeLog.findMany({
    where: { issueId: id },
    include: {
      user: { select: { id: true, name: true } },
      agentSession: { select: { model: true, provider: true } },
    },
    orderBy: { createdAt: 'desc' },
    take: 20,
  });

  return { issueId: id, ...breakdown, recentLogs };
}

// ===== Update Plan =====

export async function updatePlan(id: string, dto: UpdatePlanDto) {
  const issue = await prisma.issue.findUnique({ where: { id } });
  if (!issue) throw new AppError(404, 'Issue not found');

  const data: Prisma.IssueUpdateInput = { aiPlan: dto.plan };

  // Auto-transition to IN_PROGRESS when plan is first set
  if (issue.aiExecutionStatus === 'NOT_STARTED') {
    data.aiExecutionStatus = 'IN_PROGRESS';
  }

  return prisma.issue.update({ where: { id }, data });
}

// ===== Update Dev Result =====

export async function updateDevResult(id: string, dto: UpdateDevResultDto) {
  const issue = await prisma.issue.findUnique({ where: { id } });
  if (!issue) throw new AppError(404, 'Issue not found');

  return prisma.issue.update({
    where: { id },
    data: { aiDevResult: dto.devResult },
  });
}

// ===== Update Test Result =====

export async function updateTestResult(id: string, dto: UpdateTestResultDto) {
  const issue = await prisma.issue.findUnique({ where: { id } });
  if (!issue) throw new AppError(404, 'Issue not found');

  return prisma.issue.update({
    where: { id },
    data: { aiTestResult: dto.testResult },
  });
}

// ===== Add Dev Link =====

export async function addDevLink(id: string, dto: AddDevLinkDto) {
  const issue = await prisma.issue.findUnique({ where: { id } });
  if (!issue) throw new AppError(404, 'Issue not found');

  return prisma.devLink.create({
    data: {
      issueId: id,
      type: dto.type,
      url: dto.url,
      title: dto.title,
      sha: dto.sha,
      status: dto.status,
    },
  });
}

// ===== Update AI Status =====

export async function updateAiStatus(id: string, dto: UpdateExportAiStatusDto) {
  const issue = await prisma.issue.findUnique({ where: { id } });
  if (!issue) throw new AppError(404, 'Issue not found');

  const data: Prisma.IssueUpdateInput = {
    aiExecutionStatus: dto.aiExecutionStatus,
  };

  // Auto-transition issue to REVIEW when AI marks as DONE
  if (dto.aiExecutionStatus === 'DONE' && issue.status !== 'DONE' && issue.status !== 'CANCELLED') {
    data.status = 'REVIEW';
  }

  return prisma.issue.update({ where: { id }, data });
}
