import { Router } from 'express';
import { z } from 'zod';
import { authenticate } from '../../../shared/middleware/auth.js';
import { requireRole } from '../../../shared/middleware/rbac.js';
import { validate } from '../../../shared/middleware/validate.js';
import * as gitlabService from './gitlab.service.js';
import type { AuthRequest } from '../../../shared/types/index.js';

const router = Router();

// POST /api/integrations/gitlab/webhook — GitLab sends events here
// Secured by X-Gitlab-Token header
router.post('/integrations/gitlab/webhook', async (req, res, next) => {
  try {
    const token = req.headers['x-gitlab-token'] as string | undefined;
    const secret = process.env.GITLAB_WEBHOOK_SECRET;

    // If a global secret is configured, validate it
    if (secret && token !== secret) {
      // Try per-project token validation
        res.status(403).json({ error: 'Invalid token' });
      return;
    }

    await gitlabService.handleWebhook(req.body as Record<string, unknown>);
    res.json({ ok: true });
  } catch (err) {
    next(err);
  }
});

// Auth required below
router.use(authenticate);

const configureDto = z.object({
  projectId: z.string().uuid(),
  gitlabUrl: z.string().url(),
  gitlabToken: z.string().min(1),
  webhookToken: z.string().min(1),
});

// POST /api/integrations/gitlab/configure — ADMIN only
router.post(
  '/integrations/gitlab/configure',
  requireRole('ADMIN'),
  validate(configureDto),
  async (req: AuthRequest, res, next) => {
    try {
      const { projectId, gitlabUrl, gitlabToken, webhookToken } = req.body as z.infer<
        typeof configureDto
      >;
      const integration = await gitlabService.configure(projectId, {
        gitlabUrl,
        gitlabToken,
        webhookToken,
      });
      res.json(integration);
    } catch (err) {
      next(err);
    }
  },
);

// GET /api/integrations/gitlab/list — ADMIN only
router.get(
  '/integrations/gitlab/list',
  requireRole('ADMIN'),
  async (_req: AuthRequest, res, next) => {
    try {
      const list = await gitlabService.listIntegrations();
      res.json(list);
    } catch (err) {
      next(err);
    }
  },
);

// GET /api/integrations/gitlab/status/:projectId
router.get(
  '/integrations/gitlab/status/:projectId',
  requireRole('ADMIN', 'MANAGER'),
  async (req: AuthRequest, res, next) => {
    try {
      const integration = await gitlabService.getIntegration(req.params.projectId as string);
      res.json({ configured: !!integration?.active, gitlabUrl: integration?.gitlabUrl ?? null });
    } catch (err) {
      next(err);
    }
  },
);

// DELETE /api/integrations/gitlab/deactivate/:projectId — ADMIN only
router.delete(
  '/integrations/gitlab/deactivate/:projectId',
  requireRole('ADMIN'),
  async (req: AuthRequest, res, next) => {
    try {
      await gitlabService.deactivate(req.params.projectId as string);
      res.json({ ok: true });
    } catch (err) {
      next(err);
    }
  },
);

export default router;
