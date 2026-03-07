const { query } = require('../../db');

// ——— Tasks ———

async function listTasks(filters) {
  const { role, userId, assignee_id, status, creator_id, project_id } = filters;
  let sql = `
    SELECT t.id, t.title, t.description, t.type, t.priority, t.status,
           t.assignee_id, t.creator_id, t.estimated_hours, t.project_id,
           t.created_at, t.updated_at,
           ua.name AS assignee_name, uc.name AS creator_name,
           p.name AS project_name
    FROM tasks t
    LEFT JOIN users ua ON t.assignee_id = ua.id
    LEFT JOIN users uc ON t.creator_id = uc.id
    LEFT JOIN projects p ON t.project_id = p.id
    WHERE 1=1`;
  const params = [];
  let n = 1;
  if (role === 'user') {
    sql += ` AND (t.creator_id = $${n} OR t.assignee_id = $${n})`;
    params.push(userId);
    n++;
  }
  if (assignee_id != null) { sql += ` AND t.assignee_id = $${n}`; params.push(assignee_id); n++; }
  if (status) { sql += ` AND t.status = $${n}`; params.push(status); n++; }
  if (creator_id != null) { sql += ` AND t.creator_id = $${n}`; params.push(creator_id); n++; }
  if (project_id != null) { sql += ` AND t.project_id = $${n}`; params.push(project_id); n++; }
  sql += ' ORDER BY t.updated_at DESC';
  try {
    const result = await query(sql, params);
    return result.rows;
  } catch (e) {
    if (e.code !== '42703') throw e;
  }
  sql = `
    SELECT t.id, t.title, t.description, t.type, t.priority, t.status,
           t.assignee_id, t.creator_id, t.estimated_hours,
           t.created_at, t.updated_at,
           ua.name AS assignee_name, uc.name AS creator_name
    FROM tasks t
    LEFT JOIN users ua ON t.assignee_id = ua.id
    LEFT JOIN users uc ON t.creator_id = uc.id
    WHERE 1=1`;
  params.length = 0;
  n = 1;
  if (role === 'user') {
    sql += ` AND (t.creator_id = $${n} OR t.assignee_id = $${n})`;
    params.push(userId);
    n++;
  }
  if (assignee_id != null) { sql += ` AND t.assignee_id = $${n}`; params.push(assignee_id); n++; }
  if (status) { sql += ` AND t.status = $${n}`; params.push(status); n++; }
  if (creator_id != null) { sql += ` AND t.creator_id = $${n}`; params.push(creator_id); n++; }
  sql += ' ORDER BY t.updated_at DESC';
  const fallback = await query(sql, params);
  return fallback.rows;
}

async function createTask(data) {
  const { title, description, type, priority, status, assignee_id, creator_id, estimated_hours, project_id } = data;
  try {
    const result = await query(
      `INSERT INTO tasks (title, description, type, priority, status, assignee_id, creator_id, estimated_hours, project_id)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
       RETURNING id, title, description, type, priority, status,
                 assignee_id, creator_id, estimated_hours, project_id,
                 created_at, updated_at`,
      [title, description || null, type, priority, status, assignee_id || null, creator_id, estimated_hours || null, project_id || null]
    );
    return result.rows[0];
  } catch (e) {
    if (e.code !== '42703') throw e;
    const result = await query(
      `INSERT INTO tasks (title, description, type, priority, status, assignee_id, creator_id, estimated_hours)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
       RETURNING id, title, description, type, priority, status,
                 assignee_id, creator_id, estimated_hours,
                 created_at, updated_at`,
      [title, description || null, type, priority, status, assignee_id || null, creator_id, estimated_hours || null]
    );
    return result.rows[0];
  }
}

async function getTaskById(id) {
  try {
    const result = await query(
      `SELECT t.id, t.title, t.description, t.type, t.priority, t.status,
              t.assignee_id, t.creator_id, t.estimated_hours, t.project_id,
              t.created_at, t.updated_at,
              ua.name AS assignee_name, uc.name AS creator_name,
              p.name AS project_name
       FROM tasks t
       LEFT JOIN users ua ON t.assignee_id = ua.id
       LEFT JOIN users uc ON t.creator_id = uc.id
       LEFT JOIN projects p ON t.project_id = p.id
       WHERE t.id = $1`,
      [id]
    );
    return result.rows[0];
  } catch (e) {
    if (e.code !== '42703') throw e;
    const result = await query(
      `SELECT t.id, t.title, t.description, t.type, t.priority, t.status,
              t.assignee_id, t.creator_id, t.estimated_hours,
              t.created_at, t.updated_at,
              ua.name AS assignee_name, uc.name AS creator_name
       FROM tasks t
       LEFT JOIN users ua ON t.assignee_id = ua.id
       LEFT JOIN users uc ON t.creator_id = uc.id
       WHERE t.id = $1`,
      [id]
    );
    return result.rows[0];
  }
}

async function getTaskRowForRbac(id) {
  const result = await query('SELECT id, creator_id, assignee_id FROM tasks WHERE id = $1', [id]);
  return result.rows[0];
}

async function updateTask(id, data) {
  const { title, description, type, priority, status, assignee_id, estimated_hours, project_id } = data;
  try {
    const result = await query(
      `UPDATE tasks SET
         title = COALESCE($2, title),
         description = COALESCE($3, description),
         type = COALESCE($4, type),
         priority = COALESCE($5, priority),
         status = COALESCE($6, status),
         assignee_id = $7,
         estimated_hours = COALESCE($8, estimated_hours),
         project_id = COALESCE($9, project_id),
         updated_at = NOW()
       WHERE id = $1
       RETURNING id, title, description, type, priority, status,
                 assignee_id, creator_id, estimated_hours, project_id,
                 created_at, updated_at`,
      [id, title, description, type, priority, status, assignee_id !== undefined ? assignee_id : null, estimated_hours, project_id]
    );
    return result.rows[0];
  } catch (e) {
    if (e.code !== '42703') throw e;
    const result = await query(
      `UPDATE tasks SET
         title = COALESCE($2, title),
         description = COALESCE($3, description),
         type = COALESCE($4, type),
         priority = COALESCE($5, priority),
         status = COALESCE($6, status),
         assignee_id = $7,
         estimated_hours = COALESCE($8, estimated_hours),
         updated_at = NOW()
       WHERE id = $1
       RETURNING id, title, description, type, priority, status,
                 assignee_id, creator_id, estimated_hours,
                 created_at, updated_at`,
      [id, title, description, type, priority, status, assignee_id !== undefined ? assignee_id : null, estimated_hours]
    );
    return result.rows[0];
  }
}

async function deleteTask(id) {
  await query('DELETE FROM tasks WHERE id = $1', [id]);
}

async function getLinkedItems(taskId) {
  try {
    const result = await query(
      `SELECT ti.id, ti.title, ti.level, ti.status, ti.priority, ti.context_type, ti.context_id
       FROM task_item_links til
       JOIN task_items ti ON til.task_item_id = ti.id
       WHERE til.task_id = $1 AND til.link_type = 'origin'
       ORDER BY ti.level, ti.id`,
      [taskId]
    );
    return result.rows;
  } catch (e) {
    if (e.code !== '42P01') throw e;
    return [];
  }
}

async function createTaskLink(task_id, task_item_id, link_type) {
  await query(
    `INSERT INTO task_item_links (task_id, task_item_id, link_type)
     VALUES ($1, $2, $3)
     ON CONFLICT DO NOTHING`,
    [task_id, task_item_id, link_type || 'origin']
  );
}

// ——— Task items ———

function buildTree(rows) {
  const map = {};
  const roots = [];
  for (const r of rows) { map[r.id] = { ...r, children: [] }; }
  for (const r of rows) {
    if (r.parent_id && map[r.parent_id]) map[r.parent_id].children.push(map[r.id]);
    else roots.push(map[r.id]);
  }
  return roots;
}

async function listTaskItems(filters) {
  const { canReadAll, userId, context_type, context_id, level, status, assignee_id } = filters;
  let sql = `
    SELECT ti.*, ua.name AS assignee_name, uc.name AS creator_name, ur.name AS reviewer_name
    FROM task_items ti
    LEFT JOIN users ua ON ti.assignee_id = ua.id
    LEFT JOIN users uc ON ti.creator_id = uc.id
    LEFT JOIN users ur ON ti.reviewer_id = ur.id
    WHERE 1=1`;
  const params = [];
  let n = 1;
  if (!canReadAll) {
    sql += ` AND (ti.creator_id = $${n} OR ti.assignee_id = $${n})`;
    params.push(userId);
    n++;
  }
  if (context_type) { sql += ` AND ti.context_type = $${n}`; params.push(context_type); n++; }
  if (context_id != null) { sql += ` AND ti.context_id = $${n}`; params.push(context_id); n++; }
  if (level) { sql += ` AND ti.level = $${n}`; params.push(level); n++; }
  if (status) { sql += ` AND ti.status = $${n}`; params.push(status); n++; }
  if (assignee_id != null) { sql += ` AND ti.assignee_id = $${n}`; params.push(assignee_id); n++; }
  sql += ' ORDER BY ti.context_type, ti.context_id, ti.order_index, ti.id';
  const result = await query(sql, params);
  return buildTree(result.rows);
}

async function getTaskItemById(id) {
  const result = await query(
    `SELECT ti.*, ua.name AS assignee_name, uc.name AS creator_name, ur.name AS reviewer_name
     FROM task_items ti
     LEFT JOIN users ua ON ti.assignee_id = ua.id
     LEFT JOIN users uc ON ti.creator_id = uc.id
     LEFT JOIN users ur ON ti.reviewer_id = ur.id
     WHERE ti.id = $1`,
    [id]
  );
  return result.rows[0];
}

async function getTaskItemChildren(id, maxDepth = 3) {
  const result = await query(
    `WITH RECURSIVE tree AS (
       SELECT ti.*, ua.name AS assignee_name, uc.name AS creator_name, ur.name AS reviewer_name, 1 AS depth
       FROM task_items ti
       LEFT JOIN users ua ON ti.assignee_id = ua.id
       LEFT JOIN users uc ON ti.creator_id = uc.id
       LEFT JOIN users ur ON ti.reviewer_id = ur.id
       WHERE ti.parent_id = $1
       UNION ALL
       SELECT ti.*, ua.name, uc.name, ur.name, tree.depth + 1
       FROM task_items ti
       JOIN tree ON ti.parent_id = tree.id
       LEFT JOIN users ua ON ti.assignee_id = ua.id
       LEFT JOIN users uc ON ti.creator_id = uc.id
       LEFT JOIN users ur ON ti.reviewer_id = ur.id
       WHERE tree.depth < $2
     )
     SELECT * FROM tree ORDER BY order_index, id`,
    [id, maxDepth]
  );
  return result.rows;
}

async function getTaskItemParent(id) {
  const result = await query('SELECT id, title, level FROM task_items WHERE id = $1', [id]);
  return result.rows[0];
}

async function getOriginTasksForTaskItem(taskItemId) {
  try {
    const result = await query(
      `SELECT t.id, t.title, t.status, t.priority
       FROM task_item_links til
       JOIN tasks t ON til.task_id = t.id
       WHERE til.task_item_id = $1 AND til.link_type = 'origin'
       ORDER BY t.id`,
      [taskItemId]
    );
    return result.rows;
  } catch (e) {
    if (e.code !== '42P01') throw e;
    return [];
  }
}

async function getParentId(id) {
  const r = await query('SELECT parent_id FROM task_items WHERE id = $1', [id]);
  return r.rows[0]?.parent_id;
}

async function getParentLevel(parentId) {
  const r = await query('SELECT level FROM task_items WHERE id = $1', [parentId]);
  return r.rows[0]?.level;
}

async function createTaskItem(data) {
  const {
    parent_id, level, title, description, acceptance_criteria, context_type, context_id,
    type, priority, status, story_points, estimated_hours, assignee_id, creator_id, reviewer_id, order_index,
  } = data;
  const result = await query(
    `INSERT INTO task_items
       (parent_id, level, title, description, acceptance_criteria, context_type, context_id,
        type, priority, status, story_points, estimated_hours, assignee_id, creator_id, reviewer_id, order_index)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16)
     RETURNING *`,
    [parent_id || null, level, title, description || null, acceptance_criteria || null,
      context_type || null, context_id || null, type || 'task', priority, status,
      story_points || null, estimated_hours || null, assignee_id || null, creator_id, reviewer_id || null, order_index ?? 0]
  );
  return result.rows[0];
}

async function updateTaskItem(id, data) {
  const {
    title, description, acceptance_criteria, priority, status,
    assignee_id, story_points, estimated_hours, reviewer_id, order_index, type,
  } = data;
  const result = await query(
    `UPDATE task_items SET
       title = COALESCE($2, title),
       description = COALESCE($3, description),
       acceptance_criteria = COALESCE($4, acceptance_criteria),
       priority = COALESCE($5, priority),
       status = COALESCE($6, status),
       assignee_id = COALESCE($7, assignee_id),
       story_points = COALESCE($8, story_points),
       estimated_hours = COALESCE($9, estimated_hours),
       reviewer_id = COALESCE($10, reviewer_id),
       order_index = COALESCE($11, order_index),
       type = COALESCE($12, type),
       updated_at = NOW()
     WHERE id = $1
     RETURNING *`,
    [id, title, description, acceptance_criteria, priority, status,
      assignee_id, story_points, estimated_hours, reviewer_id, order_index, type]
  );
  return result.rows[0];
}

async function updateTaskItemStatus(id, status) {
  const result = await query(
    'UPDATE task_items SET status = $2, updated_at = NOW() WHERE id = $1 RETURNING *',
    [id, status]
  );
  return result.rows[0];
}

async function getTaskItemRowForRbac(id) {
  const result = await query('SELECT id, creator_id, assignee_id FROM task_items WHERE id = $1', [id]);
  return result.rows[0];
}

async function deleteTaskItem(id) {
  await query('DELETE FROM task_items WHERE id = $1', [id]);
}

module.exports = {
  listTasks,
  createTask,
  getTaskById,
  getTaskRowForRbac,
  updateTask,
  deleteTask,
  getLinkedItems,
  createTaskLink,
  buildTree,
  listTaskItems,
  getTaskItemById,
  getTaskItemChildren,
  getTaskItemParent,
  getOriginTasksForTaskItem,
  getParentId,
  getParentLevel,
  createTaskItem,
  updateTaskItem,
  updateTaskItemStatus,
  getTaskItemRowForRbac,
  deleteTaskItem,
};
