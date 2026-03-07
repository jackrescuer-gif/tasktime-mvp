const { query } = require('../../db');

async function listAll() {
  const result = await query(
    'SELECT id, email, name, role FROM users ORDER BY name'
  );
  return result.rows;
}

module.exports = { listAll };
