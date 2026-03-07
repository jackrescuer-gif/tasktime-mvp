const repo = require('./repository');

async function list() {
  return repo.listAll();
}

module.exports = { list };
