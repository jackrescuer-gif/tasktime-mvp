import { Router } from 'express';
import { authenticate } from '../../shared/middleware/auth.js';
import { requireRole } from '../../shared/middleware/rbac.js';
import * as adminService from './admin.service.js';

const router = Router();

router.use(authenticate, requireRole('ADMIN'));

router.get('/admin/stats', async (_req, res, next) => {
  try {
    const stats = await adminService.getStats();
    res.json(stats);
  } catch (err) {
    next(err);
  }
});

router.get('/admin/users', async (_req, res, next) => {
  try {
    const users = await adminService.listUsersWithMeta();
    res.json(users);
  } catch (err) {
    next(err);
  }
});

export default router;

