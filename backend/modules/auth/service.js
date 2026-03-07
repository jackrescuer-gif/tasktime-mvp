const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const config = require('../../config');
const { audit } = require('../../shared/audit');
const repo = require('./repository');

const { JWT_SECRET, JWT_EXPIRES_IN } = config;

async function register({ email, password, name, role }) {
  const passwordHash = await bcrypt.hash(password, 10);
  const user = await repo.createUser(email, passwordHash, name, role || 'user');
  const token = jwt.sign(
    { id: user.id, email: user.email, role: user.role },
    JWT_SECRET,
    { expiresIn: JWT_EXPIRES_IN }
  );
  return { user: { id: user.id, email: user.email, name: user.name, role: user.role }, token };
}

async function login({ email, password }, req) {
  const user = await repo.findByEmail(email);
  if (!user || !(await bcrypt.compare(password, user.password_hash))) {
    return { error: 'invalid', status: 401 };
  }
  const isBlocked = await repo.getIsBlocked(user.id);
  if (isBlocked) {
    await audit({ userId: user.id, action: 'auth.blocked_login_attempt', entityType: 'user', entityId: user.id, level: 'warning', req });
    return { error: 'blocked', status: 403, message: 'Account is blocked. Contact your administrator.' };
  }
  const token = jwt.sign(
    { id: user.id, email: user.email, role: user.role },
    JWT_SECRET,
    { expiresIn: JWT_EXPIRES_IN }
  );
  await audit({ userId: user.id, action: 'auth.login', entityType: 'user', entityId: user.id, req });
  return {
    user: { id: user.id, email: user.email, name: user.name, role: user.role },
    token,
  };
}

async function me(userId) {
  const user = await repo.findById(userId);
  return user || null;
}

async function impersonate(actorId, targetUserId, req) {
  if (parseInt(targetUserId, 10) === actorId) {
    return { error: 'self', status: 400, message: 'Cannot impersonate yourself' };
  }
  const target = await repo.getByIdForImpersonate(parseInt(targetUserId, 10));
  if (!target) return { error: 'not_found', status: 404, message: 'User not found' };
  const token = jwt.sign(
    { id: target.id, email: target.email, role: target.role },
    JWT_SECRET,
    { expiresIn: '2h' }
  );
  await audit({
    userId: actorId,
    action: 'auth.impersonate',
    entityType: 'user',
    entityId: target.id,
    details: { target_email: target.email, target_role: target.role },
    req,
  });
  return { user: { id: target.id, email: target.email, name: target.name, role: target.role }, token };
}

module.exports = {
  register,
  login,
  me,
  impersonate,
};
