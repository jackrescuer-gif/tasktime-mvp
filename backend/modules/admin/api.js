const express = require('express');
const { authMiddleware, adminMiddleware } = require('../../shared/auth');
const { isAdminOrManager } = require('../../shared/auth');
const { sendError } = require('../../shared/errors');
const service = require('./service');

const router = express.Router({ mergeParams: true });

router.get('/admin/stats', authMiddleware, adminMiddleware, async (req, res) => {
  try {
    const stats = await service.getStats();
    res.json(stats);
  } catch (e) {
    console.error('[admin/stats] error:', e.stack || e.message);
    res.status(500).json({
      error: e.message,
      stack: process.env.NODE_ENV !== 'production' ? e.stack : undefined,
    });
  }
});

router.get('/admin/users', authMiddleware, adminMiddleware, async (req, res) => {
  try {
    const list = await service.listUsers();
    res.json(list);
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

router.patch('/admin/users/:id', authMiddleware, adminMiddleware, async (req, res) => {
  try {
    const result = await service.updateUser(req.user.id, req.user.role, req.params.id, req.body, req);
    if (result.error) return sendError(res, result.status, result.error);
    res.json(result);
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

router.get('/admin/activity', authMiddleware, adminMiddleware, async (req, res) => {
  try {
    const limit = Math.min(parseInt(req.query.limit, 10) || 50, 200);
    const offset = parseInt(req.query.offset, 10) || 0;
    const data = await service.getActivityLog(limit, offset);
    res.json(data);
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

router.get('/admin/deploys', authMiddleware, adminMiddleware, async (req, res) => {
  try {
    const deploys = await service.getDeploys();
    res.json(deploys);
  } catch (_) {
    res.json([]);
  }
});

router.get('/dashboard/cio', authMiddleware, async (req, res) => {
  if (req.user.role !== 'cio' && req.user.role !== 'admin') return sendError(res, 403, 'Forbidden');
  try {
    const data = await service.getDashboardCio();
    res.json(data);
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

router.get('/dashboard/main', authMiddleware, async (req, res) => {
  try {
    const data = await service.getDashboardMain(req.user.id);
    res.json(data);
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

router.get('/business-functions', authMiddleware, async (req, res) => {
  try {
    const list = await service.listBusinessFunctions();
    res.json(list);
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

router.post('/business-functions', authMiddleware, async (req, res) => {
  if (!isAdminOrManager(req.user)) return sendError(res, 403, 'Forbidden');
  try {
    const { name, description } = req.body;
    if (!name) return sendError(res, 400, 'name required');
    const item = await service.createBusinessFunction(name, description);
    res.status(201).json(item);
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

router.get('/product-teams', authMiddleware, async (req, res) => {
  try {
    const list = await service.listProductTeams();
    res.json(list);
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

router.post('/product-teams', authMiddleware, async (req, res) => {
  if (!isAdminOrManager(req.user)) return sendError(res, 403, 'Forbidden');
  try {
    const { name, description, lead_id, status } = req.body;
    if (!name) return sendError(res, 400, 'name required');
    const team = await service.createProductTeam({ name, description, lead_id, status }, req.user.id, req);
    res.status(201).json(team);
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

router.get('/product-teams/:id', authMiddleware, async (req, res) => {
  try {
    const team = await service.getProductTeamById(req.params.id);
    if (!team) return sendError(res, 404, 'Not found');
    res.json(team);
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

router.post('/product-teams/:id/members', authMiddleware, async (req, res) => {
  if (!isAdminOrManager(req.user)) return sendError(res, 403, 'Forbidden');
  try {
    const { user_id, role = 'member' } = req.body;
    if (!user_id) return sendError(res, 400, 'user_id required');
    await service.addProductTeamMember(req.params.id, user_id, role);
    res.status(201).json({ team_id: req.params.id, user_id, role });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

router.delete('/product-teams/:id/members/:userId', authMiddleware, async (req, res) => {
  if (!isAdminOrManager(req.user)) return sendError(res, 403, 'Forbidden');
  try {
    await service.removeProductTeamMember(req.params.id, req.params.userId);
    res.status(204).send();
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

module.exports = router;
