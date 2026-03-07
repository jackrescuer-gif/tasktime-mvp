const express = require('express');
const { authMiddleware } = require('../../shared/auth');
const { sendError } = require('../../shared/errors');
const service = require('./service');

const router = express.Router({ mergeParams: true });
router.use(authMiddleware);

router.post('/tasks/:id/time/start', async (req, res) => {
  try {
    const log = await service.startTimer(req.user, req.params.id, req);
    if (log.notFound) return sendError(res, 404, 'Task not found');
    if (log.forbidden) return sendError(res, 403, 'Forbidden');
    if (log.conflict) return sendError(res, 409, 'Timer already running for this task');
    res.status(201).json(log);
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

router.post('/tasks/:id/time/stop', async (req, res) => {
  try {
    const log = await service.stopTimer(req.user, req.params.id, req);
    if (!log) return sendError(res, 404, 'No active timer found for this task');
    res.json(log);
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

router.get('/tasks/:id/time-logs', async (req, res) => {
  try {
    const list = await service.listByTaskId(req.user, req.params.id);
    if (!list) return sendError(res, 404, 'Task not found');
    if (list.forbidden) return sendError(res, 403, 'Forbidden');
    res.json(list);
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

router.get('/time-logs', async (req, res) => {
  try {
    const list = await service.listByUserId(req.user.id, req.query.task_id || null);
    res.json(list);
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

module.exports = router;
