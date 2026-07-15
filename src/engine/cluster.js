const cluster = require('cluster');
const Scheduler = require('./scheduler');
const logger = require('../lib/logger');

function runScheduler(config) {
  const scheduler = new Scheduler(config);
  scheduler.on('snapshot', (metrics) => process.send && process.send({ type: 'snapshot', metrics }));
  scheduler.on('done', (metrics) => {
    if (process.send) {
      process.send({ type: 'done', metrics }, () => process.disconnect());
    } else {
      process.emit('cluster:done', [metrics]);
    }
  });
  return scheduler.run();
}

function runCluster(config) {
  if (!cluster.isPrimary) {
    logger.configure(config);
    return runScheduler(config).catch((error) => {
      logger.error(`Worker failed: ${error.message}`);
      process.exitCode = 1;
    });
  }

  const workerCount = config.workers || 1;
  logger.info(`Starting ${workerCount} local worker${workerCount > 1 ? 's' : ''}`);
  const metrics = new Map();
  let completed = 0;

  for (let index = 0; index < workerCount; index += 1) {
    const worker = cluster.fork({ LOOPBACK_LOAD_CLUSTER_CONFIG: JSON.stringify({ ...config, workers: 1 }) });
    worker.on('message', (message) => {
      if (!message || !message.metrics) return;
      metrics.set(worker.id, message.metrics);
      process.emit('cluster:snapshot', Array.from(metrics.values()));
      if (message.type === 'done') {
        completed += 1;
        if (completed === workerCount) process.emit('cluster:done', Array.from(metrics.values()));
      }
    });
  }
}

module.exports = runCluster;
