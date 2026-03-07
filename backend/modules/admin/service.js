const os = require('os');
const { audit } = require('../../shared/audit');
const repo = require('./repository');

function formatUptimeHuman(sec) {
  const d = Math.floor(sec / 86400);
  const h = Math.floor((sec % 86400) / 3600);
  const m = Math.floor((sec % 3600) / 60);
  const parts = [];
  if (d > 0) parts.push(`${d}д`);
  if (h > 0) parts.push(`${h}ч`);
  parts.push(`${m}м`);
  return parts.join(' ');
}

function parseDeployLog(lines) {
  const deployBlocks = [];
  let current = null;
  const doneRe = /(?:DONE|SUCCESS|OK|done|success)/i;
  const errorRe = /(?:ERROR|FAIL|failed)/i;

  for (const line of lines) {
    const ts = extractTimestamp(line);
    if (line.match(/={10,}/) && ts) {
      if (current) deployBlocks.push(current);
      current = { started_at: ts, lines: [line], status: 'success' };
    } else if (current) {
      current.lines.push(line);
      if (doneRe.test(line)) current.status = 'success';
      if (errorRe.test(line)) current.status = 'error';
    } else if (ts) {
      if (!current) current = { started_at: ts, lines: [line], status: 'success' };
    }
  }
  if (current) deployBlocks.push(current);

  return deployBlocks.slice(-20).reverse().map((b, i) => ({
    id: i + 1,
    started_at: b.started_at,
    status: b.status,
    summary: b.lines.slice(0, 3).join(' | ').replace(/\s+/g, ' ').slice(0, 200),
  }));
}

function extractTimestamp(line) {
  const m = line.match(/\[(\d{4}-\d{2}-\d{2}[T ]\d{2}:\d{2}(?::\d{2})?)/);
  return m ? m[1] : null;
}

async function getStats() {
  const appUptimeSec = Math.floor(process.uptime());
  const sysUptimeSec = Math.floor(os.uptime());
  const memUsage = process.memoryUsage();

  let dbStatus = 'ok';
  let dbLatencyMs = null;
  try {
    dbLatencyMs = await repo.pingDb();
  } catch (_) {
    dbStatus = 'error';
  }

  const { usersN, tasksN, auditN, errorsN } = await repo.getCounts();

  return {
    app: {
      uptime_sec: appUptimeSec,
      uptime_human: formatUptimeHuman(appUptimeSec),
      node_version: process.version,
      env: process.env.NODE_ENV || 'development',
      memory_mb: Math.round(memUsage.rss / 1024 / 1024),
      heap_used_mb: Math.round(memUsage.heapUsed / 1024 / 1024),
      heap_total_mb: Math.round(memUsage.heapTotal / 1024 / 1024),
    },
    system: {
      uptime_sec: sysUptimeSec,
      uptime_human: formatUptimeHuman(sysUptimeSec),
      platform: process.platform,
      cpu_count: os.cpus().length,
      load_avg: os.loadavg().map((n) => +n.toFixed(2)),
      total_mem_mb: Math.round(os.totalmem() / 1024 / 1024),
      free_mem_mb: Math.round(os.freemem() / 1024 / 1024),
    },
    database: {
      status: dbStatus,
      latency_ms: dbLatencyMs,
      users: usersN,
      tasks: tasksN,
      audit_entries: auditN,
      errors_24h: errorsN,
    },
  };
}

async function listUsers() {
  return repo.listUsersWithActivity();
}

async function updateUser(actorId, actorRole, targetId, body, req) {
  const targetIdNum = parseInt(targetId, 10);
  if (isNaN(targetIdNum)) return { error: 'Invalid user id', status: 400 };

  const target = await repo.getUserForAdminUpdate(targetIdNum);
  if (!target) return { error: 'User not found', status: 404 };
  if (targetIdNum === actorId) return { error: 'Cannot modify your own account from admin panel', status: 400 };
  if ((target.role === 'admin' || target.role === 'super-admin') && actorRole !== 'super-admin') {
    return { error: 'Only super-admin can manage admin accounts', status: 403 };
  }
  const { role, is_blocked } = body;
  if (role === 'super-admin' && actorRole !== 'super-admin') {
    return { error: 'Only super-admin can assign super-admin role', status: 403 };
  }

  const fields = [];
  const params = [];
  let n = 1;
  if (role !== undefined) { fields.push(`role = $${n}`); params.push(role); n++; }
  if (is_blocked !== undefined) { fields.push(`is_blocked = $${n}`); params.push(is_blocked); n++; }
  if (!fields.length) return { error: 'Nothing to update', status: 400 };
  fields.push('updated_at = NOW()');
  params.push(targetIdNum);

  const updated = await repo.updateUser(targetIdNum, fields, params);
  await audit({
    userId: actorId,
    action: 'admin.user_updated',
    entityType: 'user',
    entityId: targetIdNum,
    details: { role, is_blocked },
    req,
  });
  return updated;
}

async function getActivityLog(limit, offset) {
  return repo.getActivityLog(limit, offset);
}

async function getDeploys() {
  const lines = repo.readDeployLogLines();
  return parseDeployLog(lines);
}

async function getDashboardCio() {
  const since30 = new Date(Date.now() - 30 * 24 * 3600 * 1000);
  const { storiesDone, taskStats, activeUsers } = await repo.getDashboardCioData(since30);
  const storiesDoneCount = parseInt(storiesDone.rows[0].cnt, 10);
  const activeUsersCount = parseInt(activeUsers.rows[0].cnt, 10);

  return {
    productivity: {
      stories_done_30d: storiesDoneCount,
      pull_requests_30d: 47,
      stories_per_person: activeUsersCount > 0 ? +(storiesDoneCount / activeUsersCount).toFixed(1) : 0,
      avg_onboarding_days: 26,
    },
    ai_penetration: {
      dau: 36, mau: 58,
      ai_code_flow_pct: 14,
      time_saved_hours: 340,
      agent_tasks: 12,
    },
    devex: {
      flow_state: 58,
      feedback_loops: 63,
      cognitive_load: 52,
    },
    task_stats: {
      total_epics: parseInt(taskStats.rows[0].total_epics, 10),
      total_stories: parseInt(taskStats.rows[0].total_stories, 10),
      total_subtasks: parseInt(taskStats.rows[0].total_subtasks, 10),
      open_count: parseInt(taskStats.rows[0].open_count, 10),
      in_progress_count: parseInt(taskStats.rows[0].in_progress_count, 10),
      done_count: parseInt(taskStats.rows[0].done_count, 10),
    },
  };
}

async function getDashboardMain(userId) {
  const { myTasks, recentActivity, projectsSummary, quickCount, teamsSummary } = await repo.getDashboardMainData(userId);
  return {
    my_tasks: myTasks.rows,
    recent_activity: recentActivity.rows,
    projects_summary: projectsSummary.rows,
    quick_tasks_count: parseInt(quickCount.rows[0].cnt, 10),
    teams_summary: teamsSummary.rows,
  };
}

async function listBusinessFunctions() {
  return repo.listBusinessFunctions();
}

async function createBusinessFunction(name, description) {
  return repo.createBusinessFunction(name, description);
}

async function listProductTeams() {
  return repo.listProductTeams();
}

async function createProductTeam(data, userId, req) {
  const team = await repo.createProductTeam(data);
  await audit({ userId, action: 'product_team.created', entityType: 'product_team', entityId: team.id, req });
  return team;
}

async function getProductTeamById(id) {
  const team = await repo.getProductTeamById(id);
  if (!team) return null;
  const [members, epics] = await Promise.all([
    repo.getProductTeamMembers(id),
    repo.getProductTeamEpics(id),
  ]);
  return { ...team, members, epics };
}

async function addProductTeamMember(teamId, userId, role) {
  await repo.addProductTeamMember(teamId, userId, role);
}

async function removeProductTeamMember(teamId, userId) {
  await repo.removeProductTeamMember(teamId, userId);
}

module.exports = {
  getStats,
  listUsers,
  updateUser,
  getActivityLog,
  getDeploys,
  getDashboardCio,
  getDashboardMain,
  listBusinessFunctions,
  createBusinessFunction,
  listProductTeams,
  createProductTeam,
  getProductTeamById,
  addProductTeamMember,
  removeProductTeamMember,
};
