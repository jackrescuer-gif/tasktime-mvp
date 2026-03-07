const express = require('express');
const { authMiddleware } = require('../../shared/auth');
const { isAdminOrManager } = require('../../shared/auth');
const { sendError } = require('../../shared/errors');
const service = require('./service');

const router = express.Router({ mergeParams: true });
router.use(authMiddleware);

router.get('/', async (req, res) => {
  try {
    const list = await service.list();
    res.json(list);
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

router.post('/', async (req, res) => {
  if (!isAdminOrManager(req.user)) return sendError(res, 403, 'Forbidden');
  try {
    const { name, description, business_goal, budget, planned_revenue, owner_id, status } = req.body;
    if (!name) return sendError(res, 400, 'name required');
    const project = await service.create(
      { name, description, business_goal, budget, planned_revenue, owner_id, status },
      req.user.id,
      req
    );
    res.status(201).json(project);
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

router.get('/:id', async (req, res) => {
  try {
    const project = await service.getById(req.params.id);
    if (!project) return sendError(res, 404, 'Not found');
    res.json(project);
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

module.exports = router;
