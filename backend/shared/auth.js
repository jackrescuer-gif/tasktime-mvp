/**
 * Shared auth middleware and permission helpers (ТЗ п. 9.4).
 * No SQL, no business logic beyond role/task checks.
 */
const jwt = require('jsonwebtoken');
const config = require('../config');

const { JWT_SECRET, COOKIE_NAME } = config;

function authMiddleware(req, res, next) {
  const authHeader = req.headers.authorization;
  const bearerToken = authHeader && authHeader.startsWith('Bearer ')
    ? authHeader.slice(7)
    : null;
  const cookieToken = (req.cookies && req.cookies[COOKIE_NAME]) || null;

  let payload = null;
  if (bearerToken) {
    try { payload = jwt.verify(bearerToken, JWT_SECRET); } catch (_) {}
  }
  if (!payload && cookieToken) {
    try { payload = jwt.verify(cookieToken, JWT_SECRET); } catch (_) {}
  }

  if (!payload) {
    return res.status(401).json({ error: 'Token required' });
  }
  req.user = { id: payload.id, email: payload.email, role: payload.role };
  next();
}

function adminMiddleware(req, res, next) {
  if (!req.user) return res.status(401).json({ error: 'Unauthorized' });
  if (req.user.role !== 'admin' && req.user.role !== 'super-admin') {
    return res.status(403).json({ error: 'Forbidden: admin role required' });
  }
  next();
}

function canReadTask(task, user) {
  if (user.role === 'admin' || user.role === 'manager') return true;
  return task.creator_id === user.id || task.assignee_id === user.id;
}

function canUpdateTask(task, user) {
  if (user.role === 'admin' || user.role === 'manager') return true;
  return task.creator_id === user.id || task.assignee_id === user.id;
}

function canDeleteTask(task, user) {
  if (user.role === 'admin' || user.role === 'manager') return true;
  return task.creator_id === user.id || task.assignee_id === user.id;
}

function isAdminOrManager(user) {
  return user.role === 'admin' || user.role === 'manager';
}

function canReadAll(user) {
  return user.role === 'admin' || user.role === 'manager' || user.role === 'cio' || user.role === 'viewer';
}

function isReadOnly(user) {
  return user.role === 'cio' || user.role === 'viewer';
}

module.exports = {
  authMiddleware,
  adminMiddleware,
  canReadTask,
  canUpdateTask,
  canDeleteTask,
  isAdminOrManager,
  canReadAll,
  isReadOnly,
  COOKIE_NAME: config.COOKIE_NAME,
  COOKIE_OPTS: config.COOKIE_OPTS,
};