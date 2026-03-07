const { query, getClient } = require('../../db');

async function getTaskForRbac(taskId) {
  const result = await query('SELECT id, creator_id, assignee_id FROM tasks WHERE id = $1', [taskId]);
  return result.rows[0];
}

async function findOpenTimer(taskId, userId) {
  const result = await query(
    'SELECT id FROM time_logs WHERE task_id = $1 AND user_id = $2 AND ended_at IS NULL',
    [taskId, userId]
  );
  return result.rows[0];
}

async function startTimer(taskId, userId, startedAt) {
  const client = await getClient();
  try {
    const insert = await client.query(
      `INSERT INTO time_logs (task_id, user_id, started_at)
       VALUES ($1, $2, $3)
       RETURNING id, task_id, user_id, started_at, ended_at, duration_minutes`,
      [taskId, userId, startedAt]
    );
    return insert.rows[0];
  } finally {
    client.release();
  }
}

async function stopTimer(taskId, userId, endedAt) {
  const result = await query(
    `UPDATE time_logs SET ended_at = $3, duration_minutes = ROUND(EXTRACT(EPOCH FROM ($3 - started_at)) / 60)::INTEGER, updated_at = NOW()
     WHERE task_id = $1 AND user_id = $2 AND ended_at IS NULL
     RETURNING id, task_id, user_id, started_at, ended_at, duration_minutes`,
    [taskId, userId, endedAt]
  );
  return result.rows[0];
}

async function listByTaskId(taskId) {
  const result = await query(
    `SELECT tl.id, tl.task_id, tl.user_id, tl.started_at, tl.ended_at, tl.duration_minutes, u.name AS user_name
     FROM time_logs tl
     JOIN users u ON tl.user_id = u.id
     WHERE tl.task_id = $1
     ORDER BY tl.started_at DESC`,
    [taskId]
  );
  return result.rows;
}

async function listByUserId(userId, taskId = null) {
  let sql = `
    SELECT tl.id, tl.task_id, tl.user_id, tl.started_at, tl.ended_at, tl.duration_minutes, t.title AS task_title
    FROM time_logs tl
    JOIN tasks t ON tl.task_id = t.id
    WHERE tl.user_id = $1`;
  const params = [userId];
  if (taskId) { sql += ' AND tl.task_id = $2'; params.push(taskId); }
  sql += ' ORDER BY tl.started_at DESC';
  const result = await query(sql, params);
  return result.rows;
}

module.exports = {
  getTaskForRbac,
  findOpenTimer,
  startTimer,
  stopTimer,
  listByTaskId,
  listByUserId,
};
