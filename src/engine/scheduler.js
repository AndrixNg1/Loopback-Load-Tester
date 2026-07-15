const EventEmitter = require('events');
const Requester = require('./requester');
const logger = require('../lib/logger');

class Scheduler extends EventEmitter {
  constructor(config) {
    super();
    this.config = config;
    this.requester = new Requester(config);
    this.running = false;
    this.metrics = {
      total: 0,
      success: 0,
      error: 0,
      latencies: [],
      statusCodes: {},
      startTime: null,
      endTime: null
    };
  }

  async run() {
    this.running = true;
    this.metrics.startTime = Date.now();

    const { warmUp, rampUp, duration, connections } = this.config;

    // 1. Warm-up
    if (warmUp > 0) {
      logger.info(`Starting warm-up phase (${warmUp}s)`);
      await this._runPhase(warmUp, 1, false);
      logger.info('Warm-up completed');
    }

    // 2. Ramp-up
    if (rampUp > 0) {
      logger.info(`Starting ramp-up phase (${rampUp}s)`);
      await this._runPhase(rampUp, connections, true, true);
      logger.info('Ramp-up completed');
    }

    // 3. Steady State
    logger.info(`Starting steady state phase (${duration}s) with ${connections} connections`);
    await this._runPhase(duration, connections, true, false);

    this.metrics.endTime = Date.now();
    this.running = false;
    await this.requester.close();
    this.emit('done', this.metrics);
  }

  async _runPhase(seconds, targetConnections, collectMetrics, isRampUp = false) {
    const start = Date.now();
    const end = start + seconds * 1000;

    let activeConnections = isRampUp ? 1 : targetConnections;
    const workers = [];

    const spawnWorker = async () => {
      while (this.running && Date.now() < end) {
        const res = await this.requester.request();
        if (collectMetrics) {
          this.metrics.total++;
          this.metrics.latencies.push(res.latency);
          this.metrics.statusCodes[res.statusCode || 'ERROR'] = (this.metrics.statusCodes[res.statusCode || 'ERROR'] || 0) + 1;
          if (res.success) {
            this.metrics.success++;
          } else {
            this.metrics.error++;
          }
          this.emit('snapshot', this.metrics);
        }
      }
    };

    // Initial workers
    for (let i = 0; i < activeConnections; i++) {
        workers.push(spawnWorker());
    }

    // Ramp-up logic
    if (isRampUp) {
        const rampInterval = (seconds * 1000) / (targetConnections - 1 || 1);
        const rampTimer = setInterval(() => {
            if (activeConnections < targetConnections) {
                activeConnections++;
                workers.push(spawnWorker());
            } else {
                clearInterval(rampTimer);
            }
        }, rampInterval);

        await new Promise(resolve => setTimeout(resolve, seconds * 1000));
        clearInterval(rampTimer);
    } else {
        await new Promise(resolve => setTimeout(resolve, seconds * 1000));
    }

    await Promise.all(workers);
  }

  stop() {
    this.running = false;
  }
}

module.exports = Scheduler;
