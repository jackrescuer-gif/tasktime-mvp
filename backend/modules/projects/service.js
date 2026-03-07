const { audit } = require('../../shared/audit');
const repo = require('./repository');

async function list() {
  return repo.list();
}

async function create(data, userId, req) {
  const project = await repo.create(data);
  await audit({ userId, action: 'project.created', entityType: 'project', entityId: project.id, req });
  return project;
}

async function getById(id) {
  const project = await repo.getById(id);
  if (!project) return null;
  const epics = await repo.getEpicsByProjectId(id);
  return { ...project, epics };
}

module.exports = { list, create, getById };
