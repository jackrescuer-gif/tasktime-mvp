const { query } = require('../../db');

async function createUser(email, passwordHash, name, role) {
  const result = await query(
    `INSERT INTO users (email, password_hash, name, role)
     VALUES ($1, $2, $3, $4)
     RETURNING id, email, name, role, created_at`,
    [email, passwordHash, name, role]
  );
  return result.rows[0];
}

async function findByEmail(email) {
  const result = await query(
    'SELECT id, email, name, role, password_hash FROM users WHERE email = $1',
    [email]
  );
  return result.rows[0];
}

async function findById(id) {
  const result = await query(
    'SELECT id, email, name, role FROM users WHERE id = $1',
    [id]
  );
  return result.rows[0];
}

async function getIsBlocked(userId) {
  try {
    const result = await query('SELECT is_blocked FROM users WHERE id = $1', [userId]);
    return result.rows[0]?.is_blocked;
  } catch (_) {
    return null;
  }
}

async function getByIdForImpersonate(userId) {
  const result = await query('SELECT id, email, name, role FROM users WHERE id = $1', [userId]);
  return result.rows[0];
}

module.exports = {
  createUser,
  findByEmail,
  findById,
  getIsBlocked,
  getByIdForImpersonate,
};
