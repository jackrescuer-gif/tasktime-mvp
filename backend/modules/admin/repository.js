const fs = require('fs');
const { query } = require('../../db');
const config = require('../../config');

async function pingDb() {
  const t0 = Date.now();
  await query('SELECT 1');
  return Date.now() - t0;
}

async function safeCount(sql) {
  try {
    const result = await query(sql);
    return parseInt(result.rows[0].cnt, 10);
  } catch (_) {
    return null;
  }
}

async function getCounts() {
  const [usersN, tasksN, auditN, errorsN] = await Promise.all([
    safeCount('SELECT COUNT(*) AS cnt FROM users'),
    safeCount('SELECT COUNT(*) AS cnt FROM tasks'),
    safeCount('SELECT COUNT(*) AS cnt FROM audit_log'),
    safeCount(`SELECT COUNT(*) AS cnt FROM audit_log WHERE level = 'error' AND created_at >= NOW() - INTERVAL '24 hours'`),
  ]);
  return { usersN, tasksN, auditN, errorsN };
}

async function listUsersWithActivity() {
  try {
    const result = await query(
      `SELECT u.id, u.email, u.name, u.role, u.is_blocked, u.created_at,
         COUNT(DISTINCT al.id) AS audit_actions,
         MAX(al.created_at) AS last_activity
       FROM users u
       LEFT JOIN audit_log al ON al.user_id = u.id
       GROUP BY u.id
       ORDER BY u.created_at DESC`
    );
    return result.rows;
  } catch (_) {
    const result = await query(
      `SELECT u.id, u.email, u.name, u.role, FALSE AS is_blocked, u.created_at,
         COUNT(DISTINCT al.id) AS audit_actions,
         MAX(al.created_at) AS last_activity
       FROM users u
       LEFT JOIN audit_log al ON al.user_id = u.id
       GROUP BY u.id
       ORDER BY u.created_at DESC`
    );
    return result.rows;
  }
}

async function getUserForAdminUpdate(userId) {
  try {
    const result = await query('SELECT id, role, is_blocked FROM users WHERE id = $1', [userId]);
    return result.rows[0];
  } catch (_) {
    const result = await query('SELECT id, role, FALSE AS is_blocked FROM users WHERE id = $1', [userId]);
    return result.rows[0];
  }
}

async function updateUser(id, fields, params) {
  const result = await query(
    `UPDATE users SET ${fields.join(', ')} WHERE id = $${params.length} RETURNING id, email, name, role, is_blocked`,
    params
  );
  return result.rows[0];
}

async function getActivityLog(limit, offset) {
  const result = await query(
    `SELECT al.id, al.created_at, al.action, al.entity_type, al.entity_id,
            al.level, al.ip, al.details,
            u.name AS user_name, u.email AS user_email, u.role AS user_role
     FROM audit_log al
     LEFT JOIN users u ON al.user_id = u.id
     ORDER BY al.created_at DESC
     LIMIT $1 OFFSET $2`,
    [limit, offset]
  );
  const total = await query('SELECT COUNT(*) AS cnt FROM audit_log');
  return { items: result.rows, total: parseInt(total.rows[0].cnt, 10) };
}

async function listBusinessFunctions() {
  const result = await query('SELECT * FROM business_functions ORDER BY name');
  return result.rows;
}

async function createBusinessFunction(name, description) {
  const result = await query(
    'INSERT INTO business_functions (name, description) VALUES ($1,$2) RETURNING *',
    [name, description || null]
  );
  return result.rows[0];
}

async function listProductTeams() {
  const result = await query(
    `SELECT pt.*, u.name AS lead_name,
       COUNT(DISTINCT ptm.user_id) AS members_count
     FROM product_teams pt
     LEFT JOIN users u ON pt.lead_id = u.id
     LEFT JOIN product_team_members ptm ON ptm.team_id = pt.id
     GROUP BY pt.id, u.name
     ORDER BY pt.name`
  );
  return result.rows;
}

async function createProductTeam(data) {
  const { name, description, lead_id, status } = data;
  const result = await query(
    'INSERT INTO product_teams (name, description, lead_id, status) VALUES ($1,$2,$3,$4) RETURNING *',
    [name, description || null, lead_id || null, status || 'active']
  );
  return result.rows[0];
}

async function getProductTeamById(id) {
  const result = await query(
    `SELECT pt.*, u.name AS lead_name FROM product_teams pt LEFT JOIN users u ON pt.lead_id = u.id WHERE pt.id = $1`,
    [id]
  );
  return result.rows[0];
}

async function getProductTeamMembers(teamId) {
  const result = await query(
    `SELECT ptm.role, u.id, u.name, u.email FROM product_team_members ptm JOIN users u ON ptm.user_id = u.id WHERE ptm.team_id = $1`,
    [teamId]
  );
  return result.rows;
}

async function getProductTeamEpics(teamId) {
  const result = await query(
    `SELECT ti.*, ua.name AS assignee_name
     FROM task_items ti LEFT JOIN users ua ON ti.assignee_id = ua.id
     WHERE ti.context_type = 'product_team' AND ti.context_id = $1 AND ti.level = 'epic'
     ORDER BY ti.order_index, ti.id`,
    [teamId]
  );
  return result.rows;
}

async function addProductTeamMember(teamId, userId, role) {
  await query(
    `INSERT INTO product_team_members (team_id, user_id, role) VALUES ($1,$2,$3) ON CONFLICT DO NOTHING`,
    [teamId, userId, role]
  );
}

async function removeProductTeamMember(teamId, userId) {
  await query('DELETE FROM product_team_members WHERE team_id = $1 AND user_id = $2', [teamId, userId]);
}

async function getDashboardCioData(since30) {
  const [storiesDone, taskStats, activeUsers] = await Promise.all([
    query(
      `SELECT COUNT(*) AS cnt FROM task_items WHERE level='story' AND status='done' AND updated_at >= $1`,
      [since30]
    ),
    query(
      `SELECT
         COUNT(*) FILTER (WHERE level='epic') AS total_epics,
         COUNT(*) FILTER (WHERE level='story') AS total_stories,
         COUNT(*) FILTER (WHERE level='subtask') AS total_subtasks,
         COUNT(*) FILTER (WHERE status='open') AS open_count,
         COUNT(*) FILTER (WHERE status='in_progress') AS in_progress_count,
         COUNT(*) FILTER (WHERE status='done') AS done_count
       FROM task_items`
    ),
    query(`SELECT COUNT(DISTINCT id) AS cnt FROM users WHERE role != 'cio'`),
  ]);
  return { storiesDone, taskStats, activeUsers };
}

async function getDashboardMainData(userId) {
  const [myTasks, recentActivity, projectsSummary, quickCount, teamsSummary] = await Promise.all([
    query(
      `SELECT ti.id, ti.title, ti.level, ti.status, ti.priority, ti.story_points,
              ti.context_type, ti.context_id, ti.updated_at
       FROM task_items ti
       WHERE ti.assignee_id = $1 AND ti.status != 'done' AND ti.status != 'cancelled'
       ORDER BY ti.updated_at DESC LIMIT 20`,
      [userId]
    ),
    query(
      `SELECT al.id, al.created_at, al.action, al.entity_type, al.entity_id, u.name AS user_name
       FROM audit_log al LEFT JOIN users u ON al.user_id = u.id
       ORDER BY al.created_at DESC LIMIT 10`
    ),
    query(
      `SELECT p.id, p.name, p.status,
         COUNT(DISTINCT ti.id) FILTER (WHERE ti.level='story') AS stories_total,
         COUNT(DISTINCT ti.id) FILTER (WHERE ti.level='story' AND ti.status='done') AS stories_done
       FROM projects p
       LEFT JOIN task_items ti ON ti.context_type='project' AND ti.context_id=p.id
       GROUP BY p.id ORDER BY p.created_at DESC LIMIT 5`
    ),
    query(`SELECT COUNT(*) AS cnt FROM task_items WHERE context_type='quick' AND status!='done' AND status!='cancelled'`),
    query(
      `SELECT pt.id, pt.name,
         COUNT(DISTINCT ptm.user_id) AS members_count,
         COUNT(DISTINCT ti.id) FILTER (WHERE ti.status='in_progress') AS active_tasks
       FROM product_teams pt
       LEFT JOIN product_team_members ptm ON ptm.team_id = pt.id
       LEFT JOIN task_items ti ON ti.context_type='product_team' AND ti.context_id=pt.id
       GROUP BY pt.id ORDER BY pt.name LIMIT 10`
    ),
  ]);
  return { myTasks, recentActivity, projectsSummary, quickCount, teamsSummary };
}

function readDeployLogLines() {
  const path = config.DEPLOY_LOG_PATH;
  if (!fs.existsSync(path)) return [];
  const raw = fs.readFileSync(path, 'utf8');
  return raw.split('\n').filter((l) => l.trim());
}

module.exports = {
  pingDb,
  getCounts,
  listUsersWithActivity,
  getUserForAdminUpdate,
  updateUser,
  getActivityLog,
  listBusinessFunctions,
  createBusinessFunction,
  listProductTeams,
  createProductTeam,
  getProductTeamById,
  getProductTeamMembers,
  getProductTeamEpics,
  addProductTeamMember,
  removeProductTeamMember,
  getDashboardCioData,
  getDashboardMainData,
  readDeployLogLines,
};
