const express = require('express');
const { authMiddleware } = require('../../shared/auth');
const { isAdminOrManager, isReadOnly } = require('../../shared/auth');
const { sendError } = require('../../shared/errors');
const service = require('./service');

const router = express.Router({ mergeParams: true });
router.use(authMiddleware);

router.get('/tasks', async (req, res) => {
  try {
    const list = await service.listTasks(req.user, req.query);
    res.json(list);
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

router.post('/tasks', async (req, res) => {
  if (isReadOnly(req.user)) return sendError(res, 403, 'Forbidden');
  try {
    if (!req.body.title) return sendError(res, 400, 'title required');
    const task = await service.createTask(req.user, req.body, req);
    res.status(201).json(task);
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

router.get('/tasks/:id', async (req, res) => {
  try {
    const task = await service.getTaskById(req.user, req.params.id);
    if (!task) return sendError(res, 404, 'Task not found');
    if (task.forbidden) return sendError(res, 403, 'Forbidden');
    res.json(task);
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

router.put('/tasks/:id', async (req, res) => {
  if (isReadOnly(req.user)) return sendError(res, 403, 'Forbidden');
  try {
    const task = await service.updateTask(req.user, req.params.id, req.body, req);
    if (!task) return sendError(res, 404, 'Task not found');
    if (task.forbidden) return sendError(res, 403, 'Forbidden');
    res.json(task);
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

router.delete('/tasks/:id', async (req, res) => {
  if (isReadOnly(req.user)) return sendError(res, 403, 'Forbidden');
  try {
    const result = await service.deleteTask(req.user, req.params.id, req);
    if (!result) return sendError(res, 404, 'Task not found');
    if (result.forbidden) return sendError(res, 403, 'Forbidden');
    res.status(204).send();
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

router.post('/task-links', async (req, res) => {
  if (!isAdminOrManager(req.user)) return sendError(res, 403, 'Forbidden');
  try {
    const { task_id, task_item_id } = req.body;
    if (!task_id || !task_item_id) return sendError(res, 400, 'task_id and task_item_id required');
    const result = await service.createTaskLink(req.user, req.body, req);
    if (result.tableMissing) return sendError(res, 501, 'Links table not available on this environment');
    res.status(201).json({ ok: true });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

router.get('/task-items', async (req, res) => {
  try {
    const list = await service.listTaskItems(req.user, req.query);
    res.json(list);
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

router.get('/task-items/:id', async (req, res) => {
  try {
    const item = await service.getTaskItemById(req.user, req.params.id);
    if (!item) return sendError(res, 404, 'Not found');
    if (item.forbidden) return sendError(res, 403, 'Forbidden');
    res.json(item);
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

router.post('/task-items', async (req, res) => {
  if (!isAdminOrManager(req.user)) return sendError(res, 403, 'Forbidden');
  try {
    const { level, title } = req.body;
    if (!level || !title) return sendError(res, 400, 'level and title required');
    const result = await service.createTaskItem(req.user, req.body, req);
    if (result.error) return sendError(res, 400, result.error);
    res.status(201).json(result);
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

router.put('/task-items/:id', async (req, res) => {
  if (isReadOnly(req.user)) return sendError(res, 403, 'Forbidden');
  try {
    const item = await service.updateTaskItem(req.user, req.params.id, req.body, req);
    if (!item) return sendError(res, 404, 'Not found');
    if (item.forbidden) return sendError(res, 403, 'Forbidden');
    res.json(item);
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

router.delete('/task-items/:id', async (req, res) => {
  if (!isAdminOrManager(req.user)) return sendError(res, 403, 'Forbidden');
  try {
    const result = await service.deleteTaskItem(req.user, req.params.id, req);
    if (!result) return sendError(res, 404, 'Not found');
    res.status(204).send();
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

router.patch('/task-items/:id/status', async (req, res) => {
  if (isReadOnly(req.user)) return sendError(res, 403, 'Forbidden');
  try {
    const { status } = req.body;
    if (!status) return sendError(res, 400, 'Invalid status');
    const item = await service.updateTaskItemStatus(req.user, req.params.id, status, req);
    if (!item) return sendError(res, 404, 'Not found');
    if (item.forbidden) return sendError(res, 403, 'Forbidden');
    if (item.error) return sendError(res, 400, item.error);
    res.json(item);
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

module.exports = router;
