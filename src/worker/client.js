const { io } = require('socket.io-client');
const os = require('os');
const runCluster = require('../engine/cluster');
const logger = require('../lib/logger');
const aggregator = require('../master/aggregator');

function startWorker(config) {
  const socket = io(config.masterUrl, { reconnection: true });
  let running = false;

  socket.on('connect', () => {
    logger.success(`Connected to ${config.masterUrl}`);
    socket.emit('worker:register', { hostname: os.hostname(), name: config.name, cpus: os.cpus().length });
  });
  socket.on('connect_error', (error) => logger.warn(`Master connection failed: ${error.message}`));
  socket.on('master:config', (masterConfig) => {
    if (running) return;
    running = true;
    const delay = Math.max(0, masterConfig.startAt - Date.now());
    logger.info(`Test starts in ${(delay / 1000).toFixed(1)}s`);
    setTimeout(() => runCluster(masterConfig), delay);
  });
  process.on('cluster:snapshot', (metrics) => {
    aggregator.update(metrics);
    socket.emit('worker:metrics', aggregator.aggregated);
  });
  process.once('cluster:done', (metrics) => {
    aggregator.update(metrics);
    socket.emit('worker:done', aggregator.aggregated);
    logger.success('Test completed');
    setTimeout(() => socket.close(), 250);
  });
  return socket;
}

module.exports = startWorker;
