const logger = require('../lib/logger');

function broadcastStart(io, config) {
  const startAt = Date.now() + 3000;
  logger.info(`Broadcasting start at ${new Date(startAt).toISOString()}`);

  const { masterUrl, mode, port, expectedWorkers, ...testConfig } = config;
  io.emit('master:config', { ...testConfig, mode: 'local', startAt });
}

module.exports = { broadcastStart };
