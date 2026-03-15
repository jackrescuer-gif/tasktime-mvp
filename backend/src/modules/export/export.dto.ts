import { z } from 'zod';

export const openTasksQueryDto = z.object({
  projectId: z.string().uuid().optional(),
  projectKey: z.string().max(10).optional(),
  onlyAiEligible: z.coerce.boolean().optional(),
  assigneeType: z.enum(['HUMAN', 'AGENT', 'MIXED']).optional(),
  type: z.enum(['EPIC', 'STORY', 'TASK', 'SUBTASK', 'BUG']).optional(),
  priority: z.enum(['CRITICAL', 'HIGH', 'MEDIUM', 'LOW']).optional(),
  search: z.string().max(200).optional(),
});

export type OpenTasksQueryDto = z.infer<typeof openTasksQueryDto>;

export const updatePlanDto = z.object({
  plan: z.string().min(1).max(50000),
});

export type UpdatePlanDto = z.infer<typeof updatePlanDto>;

export const updateDevResultDto = z.object({
  devResult: z.string().min(1).max(100000),
  summary: z.string().max(2000).optional(),
});

export type UpdateDevResultDto = z.infer<typeof updateDevResultDto>;

export const updateTestResultDto = z.object({
  testResult: z.string().min(1).max(100000),
  passed: z.boolean().optional(),
  coverage: z.number().min(0).max(100).optional(),
});

export type UpdateTestResultDto = z.infer<typeof updateTestResultDto>;

export const addDevLinkDto = z.object({
  type: z.enum(['COMMIT', 'BRANCH', 'PULL_REQUEST', 'MERGE']),
  url: z.string().url().max(2000),
  title: z.string().max(500).optional(),
  sha: z.string().max(100).optional(),
  status: z.string().max(50).optional(),
});

export type AddDevLinkDto = z.infer<typeof addDevLinkDto>;

export const updateExportAiStatusDto = z.object({
  aiExecutionStatus: z.enum(['NOT_STARTED', 'IN_PROGRESS', 'DONE', 'FAILED']),
});

export type UpdateExportAiStatusDto = z.infer<typeof updateExportAiStatusDto>;
