import { Router } from 'express';
import { authenticate } from '../../shared/middleware/auth.js';
import { requireRole } from '../../shared/middleware/rbac.js';
import { validate } from '../../shared/middleware/validate.js';
import { logAudit } from '../../shared/middleware/audit.js';
import {
  openTasksQueryDto,
  updatePlanDto,
  updateDevResultDto,
  updateTestResultDto,
  addDevLinkDto,
  updateExportAiStatusDto,
} from './export.dto.js';
import * as exportService from './export.service.js';
import type { AuthRequest } from '../../shared/types/index.js';

const router = Router();
router.use(authenticate);

// GET /export/open-tasks — list open tasks with time breakdown
router.get('/export/open-tasks', validate(openTasksQueryDto, 'query'), async (req: AuthRequest, res, next) => {
  try {
    const result = await exportService.getOpenTasks(req.query as any);
    res.json(result);
  } catch (err) { next(err); }
});

// GET /export/open-tasks/:id — detailed open task
router.get('/export/open-tasks/:id', async (req: AuthRequest, res, next) => {
  try {
    const task = await exportService.getOpenTaskDetail(req.params.id as string);
    res.json(task);
  } catch (err) { next(err); }
});

// GET /export/tasks/:id/time-summary — detailed time breakdown
router.get('/export/tasks/:id/time-summary', async (req: AuthRequest, res, next) => {
  try {
    const summary = await exportService.getTaskTimeSummary(req.params.id as string);
    res.json(summary);
  } catch (err) { next(err); }
});

// PATCH /export/tasks/:id/plan — agent submits plan
router.patch(
  '/export/tasks/:id/plan',
  requireRole('ADMIN', 'MANAGER'),
  validate(updatePlanDto),
  async (req: AuthRequest, res, next) => {
    try {
      const issue = await exportService.updatePlan(req.params.id as string, req.body);
      await logAudit(req, 'issue.plan_updated', 'issue', issue.id, { planLength: req.body.plan.length });
      res.json(issue);
    } catch (err) { next(err); }
  },
);

// PATCH /export/tasks/:id/dev-result — agent submits dev result
router.patch(
  '/export/tasks/:id/dev-result',
  requireRole('ADMIN', 'MANAGER'),
  validate(updateDevResultDto),
  async (req: AuthRequest, res, next) => {
    try {
      const issue = await exportService.updateDevResult(req.params.id as string, req.body);
      await logAudit(req, 'issue.dev_result_updated', 'issue', issue.id, { summary: req.body.summary });
      res.json(issue);
    } catch (err) { next(err); }
  },
);

// PATCH /export/tasks/:id/test-result — agent submits test result
router.patch(
  '/export/tasks/:id/test-result',
  requireRole('ADMIN', 'MANAGER'),
  validate(updateTestResultDto),
  async (req: AuthRequest, res, next) => {
    try {
      const issue = await exportService.updateTestResult(req.params.id as string, req.body);
      await logAudit(req, 'issue.test_result_updated', 'issue', issue.id, {
        passed: req.body.passed,
        coverage: req.body.coverage,
      });
      res.json(issue);
    } catch (err) { next(err); }
  },
);

// POST /export/tasks/:id/dev-links — attach commit/PR/merge link
router.post(
  '/export/tasks/:id/dev-links',
  requireRole('ADMIN', 'MANAGER'),
  validate(addDevLinkDto),
  async (req: AuthRequest, res, next) => {
    try {
      const link = await exportService.addDevLink(req.params.id as string, req.body);
      await logAudit(req, 'issue.dev_link_added', 'issue', req.params.id as string, {
        linkType: link.type,
        url: link.url,
      });
      res.status(201).json(link);
    } catch (err) { next(err); }
  },
);

// PATCH /export/tasks/:id/ai-status — update AI execution status
router.patch(
  '/export/tasks/:id/ai-status',
  requireRole('ADMIN', 'MANAGER'),
  validate(updateExportAiStatusDto),
  async (req: AuthRequest, res, next) => {
    try {
      const issue = await exportService.updateAiStatus(req.params.id as string, req.body);
      await logAudit(req, 'issue.ai_status_updated', 'issue', issue.id, {
        aiExecutionStatus: req.body.aiExecutionStatus,
      });
      res.json(issue);
    } catch (err) { next(err); }
  },
);

export default router;
