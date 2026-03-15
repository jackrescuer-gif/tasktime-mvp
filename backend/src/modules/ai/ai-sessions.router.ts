import { Router } from 'express';
import { authenticate } from '../../shared/middleware/auth.js';
import { requireRole } from '../../shared/middleware/rbac.js';
import { validate } from '../../shared/middleware/validate.js';
import { createAiSessionDto } from './ai-sessions.dto.js';
import * as aiSessionsService from './ai-sessions.service.js';
import { estimateIssue } from './ai-estimate.service.js';
import { decomposeIssue, applyDecompose } from './ai-decompose.service.js';
import { z } from 'zod';
import type { AuthRequest } from '../../shared/types/index.js';

const router = Router();
router.use(authenticate);

// Для регистрации сессий ИИ считаем, что нужны права не ниже MANAGER
router.post(
  '/ai-sessions',
  requireRole('ADMIN', 'MANAGER'),
  validate(createAiSessionDto),
  async (req: AuthRequest, res, next) => {
    try {
      const session = await aiSessionsService.createAiSession(req.body);
      res.status(201).json(session);
    } catch (err) {
      next(err);
    }
  },
);

// POST /api/ai/estimate/:issueId — AI estimate of effort
router.post(
  '/ai/estimate/:issueId',
  requireRole('ADMIN', 'MANAGER', 'USER'),
  async (req: AuthRequest, res, next) => {
    try {
      const result = await estimateIssue(req.params.issueId as string, req.user!.userId);
      res.json(result);
    } catch (err) {
      next(err);
    }
  },
);

const applyDecomposeDto = z.object({
  selectedIndexes: z.array(z.number().int().nonnegative()),
  suggestions: z.array(
    z.object({
      title: z.string().min(1),
      description: z.string().optional().default(''),
      estimatedHours: z.number().positive(),
    }),
  ),
});

// POST /api/ai/decompose/:issueId — get AI decomposition suggestions
router.post(
  '/ai/decompose/:issueId',
  requireRole('ADMIN', 'MANAGER', 'USER'),
  async (req: AuthRequest, res, next) => {
    try {
      const result = await decomposeIssue(req.params.issueId as string, req.user!.userId);
      res.json(result);
    } catch (err) {
      next(err);
    }
  },
);

// POST /api/ai/decompose/:issueId/apply — create selected child issues
router.post(
  '/ai/decompose/:issueId/apply',
  requireRole('ADMIN', 'MANAGER', 'USER'),
  validate(applyDecomposeDto),
  async (req: AuthRequest, res, next) => {
    try {
      const { selectedIndexes, suggestions } = req.body as z.infer<typeof applyDecomposeDto>;
      const result = await applyDecompose(req.params.issueId as string, selectedIndexes, suggestions, req.user!.userId);
      res.json(result);
    } catch (err) {
      next(err);
    }
  },
);

export default router;

