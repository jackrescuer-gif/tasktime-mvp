const config = require('../../config');
const { audit } = require('../../shared/audit');
const { canReadTask, canUpdateTask, canDeleteTask, isAdminOrManager, canReadAll, isReadOnly } = require('../../shared/auth');
const repo = require('./repository');

const { PIXEL_OFFICE_WEBHOOK_URL } = config;

async function listTasks(user, query) {
  const filters = {
    role: user.role,
    userId: user.id,
    assignee_id: query.assignee_id != null ? query.assignee_id : undefined,
    status: query.status,
    creator_id: query.creator_id != null ? query.creator_id : undefined,
    project_id: query.project_id != null ? query.project_id : undefined,
  };
  return repo.listTasks(filters);
}

async function createTask(user, body, req) {
  const data = {
    title: body.title,
    description: body.description,
    type: body.type || 'task',
    priority: body.priority || 'medium',
    status: body.status || 'open',
    assignee_id: body.assignee_id,
    creator_id: user.id,
    estimated_hours: body.estimated_hours,
    project_id: body.project_id,
  };
  const task = await repo.createTask(data);
  await audit({ userId: user.id, action: 'task.create', entityType: 'task', entityId: task.id, req });
  if (PIXEL_OFFICE_WEBHOOK_URL && task) {
    fetch(PIXEL_OFFICE_WEBHOOK_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        source: 'tasktime',
        event: 'task.created',
        task: {
          id: task.id,
          title: task.title,
          description: task.description,
          priority: task.priority,
          status: task.status,
          assignee_id: task.assignee_id,
          creator_id: task.creator_id,
          created_at: task.created_at,
        },
      }),
    }).catch((err) => console.error('Pixel Office webhook error:', err.message));
  }
  return task;
}

async function getTaskById(user, taskId) {
  const task = await repo.getTaskById(taskId);
  if (!task) return null;
  if (!canReadTask(task, user)) return { forbidden: true };
  const linkedItems = await repo.getLinkedItems(taskId);
  return { ...task, linked_items: linkedItems };
}

async function updateTask(user, taskId, body, req) {
  const row = await repo.getTaskRowForRbac(taskId);
  if (!row) return null;
  if (!canUpdateTask(row, user)) return { forbidden: true };
  const task = await repo.updateTask(taskId, {
    title: body.title,
    description: body.description,
    type: body.type,
    priority: body.priority,
    status: body.status,
    assignee_id: body.assignee_id,
    estimated_hours: body.estimated_hours,
    project_id: body.project_id,
  });
  await audit({ userId: user.id, action: 'task.update', entityType: 'task', entityId: task.id, req });
  return task;
}

async function deleteTask(user, taskId, req) {
  const row = await repo.getTaskRowForRbac(taskId);
  if (!row) return null;
  if (!canDeleteTask(row, user)) return { forbidden: true };
  await repo.deleteTask(taskId);
  await audit({ userId: user.id, action: 'task.delete', entityType: 'task', entityId: taskId, req });
  return { ok: true };
}

async function createTaskLink(user, body, req) {
  const { task_id, task_item_id, link_type } = body;
  try {
    await repo.createTaskLink(task_id, task_item_id, link_type);
  } catch (e) {
    if (e.code === '42P01') return { tableMissing: true };
    throw e;
  }
  await audit({
    userId: user.id,
    action: 'task_link.created',
    entityType: 'task_link',
    entityId: `${task_id}:${task_item_id}`,
    details: { task_id, task_item_id, link_type },
    req,
  });
  return { ok: true };
}

async function listTaskItems(user, query) {
  const filters = {
    canReadAll: canReadAll(user),
    userId: user.id,
    context_type: query.context_type,
    context_id: query.context_id != null ? query.context_id : undefined,
    level: query.level,
    status: query.status,
    assignee_id: query.assignee_id != null ? query.assignee_id : undefined,
  };
  return repo.listTaskItems(filters);
}

async function getTaskItemById(user, id) {
  const root = await repo.getTaskItemById(id);
  if (!root) return null;
  if (!canReadAll(user) && root.creator_id !== user.id && root.assignee_id !== user.id) {
    return { forbidden: true };
  }
  const children = await repo.getTaskItemChildren(id);
  const breadcrumb = [];
  let cur = root;
  while (cur.parent_id) {
    const parent = await repo.getTaskItemParent(cur.parent_id);
    if (!parent) break;
    breadcrumb.unshift(parent);
    cur = parent;
  }
  const originTasks = await repo.getOriginTasksForTaskItem(id);
  return { ...root, children: repo.buildTree(children), breadcrumb, origin_tasks: originTasks };
}

async function createTaskItem(user, body, req) {
  const { parent_id, level, title, description, acceptance_criteria, context_type, context_id,
    priority, status, assignee_id, story_points, estimated_hours, reviewer_id, order_index, type } = body;
  if (parent_id) {
    const parentLevel = await repo.getParentLevel(parent_id);
    if (!parentLevel) return { error: 'Parent not found' };
    if (parentLevel === 'epic' && level !== 'story') return { error: 'Children of epic must be story' };
    if (parentLevel === 'story' && level !== 'subtask') return { error: 'Children of story must be subtask' };
    if (parentLevel === 'subtask') return { error: 'Subtask cannot have children' };
  }
  const item = await repo.createTaskItem({
    parent_id, level, title, description, acceptance_criteria, context_type, context_id,
    type: type || 'task', priority: priority || 'medium', status: status || 'open',
    story_points, estimated_hours, assignee_id, creator_id: user.id, reviewer_id, order_index: order_index ?? 0,
  });
  await audit({ userId: user.id, action: 'task_item.created', entityType: 'task_item', entityId: item.id, req });
  return item;
}

async function updateTaskItem(user, id, body, req) {
  const row = await repo.getTaskItemRowForRbac(id);
  if (!row) return null;
  if (!isAdminOrManager(user) && row.creator_id !== user.id && row.assignee_id !== user.id) {
    return { forbidden: true };
  }
  const item = await repo.updateTaskItem(id, {
    title: body.title,
    description: body.description,
    acceptance_criteria: body.acceptance_criteria,
    priority: body.priority,
    status: body.status,
    assignee_id: body.assignee_id,
    story_points: body.story_points,
    estimated_hours: body.estimated_hours,
    reviewer_id: body.reviewer_id,
    order_index: body.order_index,
    type: body.type,
  });
  await audit({ userId: user.id, action: 'task_item.updated', entityType: 'task_item', entityId: id, req });
  return item;
}

async function deleteTaskItem(user, id, req) {
  const row = await repo.getTaskItemRowForRbac(id);
  if (!row) return null;
  await repo.deleteTaskItem(id);
  await audit({ userId: user.id, action: 'task_item.deleted', entityType: 'task_item', entityId: id, req });
  return { ok: true };
}

async function updateTaskItemStatus(user, id, status, req) {
  const valid = ['open', 'in_progress', 'in_review', 'done', 'cancelled'];
  if (!valid.includes(status)) return { error: 'Invalid status' };
  const row = await repo.getTaskItemRowForRbac(id);
  if (!row) return null;
  if (!isAdminOrManager(user) && row.creator_id !== user.id && row.assignee_id !== user.id) {
    return { forbidden: true };
  }
  const item = await repo.updateTaskItemStatus(id, status);
  await audit({ userId: user.id, action: 'task_item.status_changed', entityType: 'task_item', entityId: id, details: { status }, req });
  return item;
}

module.exports = {
  listTasks,
  createTask,
  getTaskById,
  updateTask,
  deleteTask,
  createTaskLink,
  listTaskItems,
  getTaskItemById,
  createTaskItem,
  updateTaskItem,
  deleteTaskItem,
  updateTaskItemStatus,
};
