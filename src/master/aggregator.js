const { percentile } = require('../scenarios/validator');

class Aggregator {
  constructor() { this.reset(); }

  reset() {
    this.aggregated = { total: 0, success: 0, error: 0, latencies: [], statusCodes: {}, startTime: null, endTime: null };
  }

  update(workerMetrics = []) {
    this.reset();
    for (const metrics of workerMetrics) {
      if (!metrics) continue;
      this.aggregated.total += metrics.total || 0;
      this.aggregated.success += metrics.success || 0;
      this.aggregated.error += metrics.error || 0;
      this.aggregated.latencies.push(...(metrics.latencies || []));
      for (const [code, count] of Object.entries(metrics.statusCodes || {})) {
        this.aggregated.statusCodes[code] = (this.aggregated.statusCodes[code] || 0) + count;
      }
      if (metrics.startTime && (!this.aggregated.startTime || metrics.startTime < this.aggregated.startTime)) this.aggregated.startTime = metrics.startTime;
      if (metrics.endTime && (!this.aggregated.endTime || metrics.endTime > this.aggregated.endTime)) this.aggregated.endTime = metrics.endTime;
    }
    process.emit('aggregator:update', this.aggregated);
  }

  getFinalReport() {
    const raw = this.aggregated;
    const duration = raw.startTime && raw.endTime ? (raw.endTime - raw.startTime) / 1000 : 0;
    return {
      raw,
      aggregated: {
        requests: { total: raw.total, rate: duration ? raw.total / duration : 0 },
        latency: { p50: percentile(raw.latencies, 50), p95: percentile(raw.latencies, 95), p99: percentile(raw.latencies, 99) },
        status: raw.statusCodes,
        successRate: raw.total ? (raw.success / raw.total) * 100 : 0,
        duration
      }
    };
  }
}

module.exports = new Aggregator();
