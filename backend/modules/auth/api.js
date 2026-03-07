const express = require('express');
const { authMiddleware } = require('../../shared/auth');
const { COOKIE_NAME, COOKIE_OPTS } = require('../../shared/auth');
const { audit } = require('../../shared/audit');
const { sendError } = require('../../shared/errors');
const service = require('./service');

const router = express.Router();

router.post('/register', async (req, res) => {
  try {
    const { email, password, name, role } = req.body;
    if (!email || !password || !name) {
      return sendError(res, 400, 'email, password, name required');
    }
    const result = await service.register({ email, password, name, role });
    await audit({ userId: result.user.id, action: 'auth.register', entityType: 'user', entityId: result.user.id, req });
    res.status(201).json(result);
  } catch (e) {
    if (e.code === '23505') return sendError(res, 409, 'Email already exists');
    res.status(500).json({ error: e.message });
  }
});

router.post('/login', async (req, res) => {
  try {
    const { email, password } = req.body;
    if (!email || !password) {
      return sendError(res, 400, 'email and password required');
    }
    const result = await service.login({ email, password }, req);
    if (result.error === 'invalid') return sendError(res, 401, 'Invalid email or password');
    if (result.error === 'blocked') return sendError(res, 403, result.message);
    res.cookie(COOKIE_NAME, result.token, COOKIE_OPTS);
    res.json(result);
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

router.get('/me', authMiddleware, async (req, res) => {
  try {
    const user = await service.me(req.user.id);
    if (!user) return sendError(res, 404, 'User not found');
    res.json(user);
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

router.post('/logout', (req, res) => {
  res.clearCookie(COOKIE_NAME, { path: '/' });
  res.json({ ok: true });
});

router.post('/impersonate', authMiddleware, async (req, res) => {
  if (req.user.role !== 'admin' && req.user.role !== 'super-admin') {
    return sendError(res, 403, 'Forbidden');
  }
  try {
    const { user_id } = req.body;
    if (!user_id) return sendError(res, 400, 'user_id required');
    const result = await service.impersonate(req.user.id, user_id, req);
    if (result.error === 'self') return sendError(res, 400, result.message);
    if (result.error === 'not_found') return sendError(res, 404, result.message);
    res.json(result);
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

module.exports = router;
