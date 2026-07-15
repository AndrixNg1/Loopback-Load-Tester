const Fastify = require('fastify');
const { Server } = require('socket.io');
const logger = require('../lib/logger');
const aggregator = require('./aggregator');
const { broadcastStart } = require('./sync');

async function startMaster(config) {
  const app = Fastify({ logger: false });
  await app.listen({ port: config.port, host: '0.0.0.0' });
  const io = new Server(app.server);
  const workers = new Map();
  let started = false;
  logger.success(`Master listening on 0.0.0.0:${config.port}`);

  function aggregate() {
    aggregator.update(Array.from(workers.values(), (worker) => worker.metrics).filter(Boolean));
  }

  io.on('connection', (socket) => {
    socket.on('worker:register', (info) => {
      workers.set(socket.id, { info, metrics: null, done: false });
      logger.info(`Worker connected: ${info.name || info.hostname} (${info.cpus} CPUs)`);
      if (!started && workers.size >= config.expectedWorkers) {
        started = true;
        broadcastStart(io, config);
      }
    });

    socket.on('worker:metrics', (metrics) => {
      const worker = workers.get(socket.id);
      if (worker) { worker.metrics = metrics; aggregate(); }
    });

    socket.on('worker:done', (metrics) => {
      const worker = workers.get(socket.id);
      if (!worker) return;
      worker.metrics = metrics;
      worker.done = true;
      aggregate();
      if (workers.size >= config.expectedWorkers && Array.from(workers.values()).every((item) => item.done)) {
        process.emit('master:allDone');
        io.close();
        app.close();
      }
    });

    socket.on('disconnect', () => {
      if (!workers.get(socket.id)?.done) logger.warn(`Worker disconnected before completion: ${socket.id}`);
      workers.delete(socket.id);
    });
  });
  return app;
}

module.exports = startMaster;
