const { audit } = require('../../shared/audit');
const { canReadTask } = require('../../shared/auth');
const repo = require('./repository');

async function startTimer(user, taskId, req) {
  const task = await repo.getTaskForRbac(taskId);
  if (!task) return { notFound: true };
  if (!canReadTask(task, user)) return { forbidden: true };
  const open = await repo.findOpenTimer(taskId, user.id);
  if (open) return { conflict: true };
  const startedAt = new Date();
  const log = await repo.startTimer(taskId, user.id, startedAt);
  audit({ userId: user.id, action: 'time.start', entityType: 'time_log', entityId: log.id, details: { task_id: taskId }, req }).catch(() => {});
  return log;
}

async function stopTimer(user, taskId, req) {
  const endedAt = new Date();
  const log = await repo.stopTimer(taskId, user.id, endedAt);
  if (!log) return null;
  audit({
    userId: user.id,
    action: 'time.stop',
    entityType: 'time_log',
    entityId: log.id,
    details: { task_id: taskId, duration_minutes: log.duration_minutes },
    req,
  }).catch(() => {});
  return log;
}

async function listByTaskId(user, taskId) {
  const task = await repo.getTaskForRbac(taskId);
  if (!task) return null;
  if (!canReadTask(task, user)) return { forbidden: true };
  return repo.listByTaskId(taskId);
}

async function listByUserId(userId, taskId = null) {
  return repo.listByUserId(userId, taskId);
}

module.exports = {
  startTimer,
  stopTimer,
  listByTaskId,
  listByUserId,
};
