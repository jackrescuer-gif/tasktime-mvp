import { Router } from 'express';
import { authenticate } from '../../shared/middleware/auth.js';
import { requireRole } from '../../shared/middleware/rbac.js';
import * as adminService from './admin.service.js';
import * as exportService from './reports-export.service.js';
import type { UatRole } from './uat-tests.data.js';

const router = Router();

router.use(authenticate);

router.get('/admin/stats', requireRole('ADMIN', 'MANAGER', 'VIEWER'), async (_req, res, next) => {
  try {
    const stats = await adminService.getStats();
    res.json(stats);
  } catch (err) {
    next(err);
  }
});

router.get('/admin/users', requireRole('ADMIN'), async (_req, res, next) => {
  try {
    const users = await adminService.listUsersWithMeta();
    res.json(users);
  } catch (err) {
    next(err);
  }
});

router.get('/admin/activity', requireRole('ADMIN', 'MANAGER', 'VIEWER'), async (_req, res, next) => {
  try {
    const activity = await adminService.getActivity();
    res.json(activity);
  } catch (err) {
    next(err);
  }
});

router.get('/admin/uat-tests', requireRole('ADMIN', 'MANAGER', 'USER', 'VIEWER'), async (req, res, next) => {
  try {
    const { role } = req.query as { role?: UatRole };
    const tests = await adminService.listUatTests({ role });
    res.json(tests);
  } catch (err) {
    next(err);
  }
});

router.get(
  '/admin/reports/issues-by-status',
  requireRole('ADMIN', 'MANAGER', 'VIEWER'),
  async (req, res, next) => {
    try {
      const { projectId, sprintId, from, to } = req.query as {
        projectId?: string;
        sprintId?: string;
        from?: string;
        to?: string;
      };

      if (!projectId) {
        res.status(400).json({ error: 'projectId is required' });
        return;
      }

      const data = await adminService.getIssuesByStatusReport({ projectId, sprintId, from, to });
      res.json(data);
    } catch (err) {
      next(err);
    }
  }
);

router.get(
  '/admin/reports/issues-by-assignee',
  requireRole('ADMIN', 'MANAGER', 'VIEWER'),
  async (req, res, next) => {
    try {
      const { projectId, sprintId, from, to } = req.query as {
        projectId?: string;
        sprintId?: string;
        from?: string;
        to?: string;
      };

      if (!projectId) {
        res.status(400).json({ error: 'projectId is required' });
        return;
      }

      const data = await adminService.getIssuesByAssigneeReport({ projectId, sprintId, from, to });
      res.json(data);
    } catch (err) {
      next(err);
    }
  }
);

// ===== EXPORT ENDPOINTS =====

type ExportFormat = 'csv' | 'pdf';

function parseExportQuery(query: Record<string, string | undefined>) {
  const { projectId, sprintId, from, to, status, format } = query;
  return { projectId, sprintId, from, to, status, format: (format ?? 'csv') as ExportFormat };
}

router.get(
  '/admin/reports/issues/export',
  requireRole('ADMIN', 'MANAGER'),
  async (req, res, next) => {
    try {
      const { projectId, sprintId, from, to, status, format } = parseExportQuery(
        req.query as Record<string, string | undefined>,
      );
      if (!projectId) { res.status(400).json({ error: 'projectId required' }); return; }

      if (format === 'pdf') {
        const buf = await exportService.exportIssuesPdf({ projectId, sprintId, from, to, status });
        res.setHeader('Content-Type', 'application/pdf');
        res.setHeader('Content-Disposition', `attachment; filename="issues-${projectId}.pdf"`);
        res.send(buf);
      } else {
        const buf = await exportService.exportIssuesCsv({ projectId, sprintId, from, to, status });
        res.setHeader('Content-Type', 'text/csv; charset=utf-8');
        res.setHeader('Content-Disposition', `attachment; filename="issues-${projectId}.csv"`);
        res.send(buf);
      }
    } catch (err) {
      next(err);
    }
  },
);

router.get(
  '/admin/reports/time/export',
  requireRole('ADMIN', 'MANAGER'),
  async (req, res, next) => {
    try {
      const { projectId, from, to } = parseExportQuery(
        req.query as Record<string, string | undefined>,
      );
      if (!projectId) { res.status(400).json({ error: 'projectId required' }); return; }

      const buf = await exportService.exportTimeCsv({ projectId, from, to });
      res.setHeader('Content-Type', 'text/csv; charset=utf-8');
      res.setHeader('Content-Disposition', `attachment; filename="time-${projectId}.csv"`);
      res.send(buf);
    } catch (err) {
      next(err);
    }
  },
);

export default router;

