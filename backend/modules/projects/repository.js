const { query } = require('../../db');

async function list() {
  const result = await query(
    `SELECT p.*, u.name AS owner_name,
       COUNT(DISTINCT ti.id) FILTER (WHERE ti.level='epic') AS epics_count,
       COUNT(DISTINCT ti.id) FILTER (WHERE ti.level='story') AS stories_count,
       COUNT(DISTINCT ti.id) FILTER (WHERE ti.status='done') AS done_count
     FROM projects p
     LEFT JOIN users u ON p.owner_id = u.id
     LEFT JOIN task_items ti ON ti.context_type = 'project' AND ti.context_id = p.id
     GROUP BY p.id, u.name
     ORDER BY p.created_at DESC`
  );
  return result.rows;
}

async function create(data) {
  const { name, description, business_goal, budget, planned_revenue, owner_id, status } = data;
  const result = await query(
    `INSERT INTO projects (name, description, business_goal, budget, planned_revenue, owner_id, status)
     VALUES ($1,$2,$3,$4,$5,$6,$7) RETURNING *`,
    [name, description || null, business_goal || null, budget || null, planned_revenue || null, owner_id || null, status || 'active']
  );
  return result.rows[0];
}

async function getById(id) {
  const result = await query(
    `SELECT p.*, u.name AS owner_name FROM projects p LEFT JOIN users u ON p.owner_id = u.id WHERE p.id = $1`,
    [id]
  );
  return result.rows[0];
}

async function getEpicsByProjectId(projectId) {
  const result = await query(
    `SELECT ti.*, ua.name AS assignee_name
     FROM task_items ti LEFT JOIN users ua ON ti.assignee_id = ua.id
     WHERE ti.context_type = 'project' AND ti.context_id = $1 AND ti.level = 'epic'
     ORDER BY ti.order_index, ti.id`,
    [projectId]
  );
  return result.rows;
}

module.exports = { list, create, getById, getEpicsByProjectId };
