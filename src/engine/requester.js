const { Pool } = require('undici');
const logger = require('../lib/logger');
const { loadScenario, selectRoute } = require('../scenarios/loader');

class Requester {
  constructor(options = {}) {
    this.url = new URL(options.url || 'http://localhost');
    this.pool = new Pool(this.url.origin, {
      connections: options.connections || 20,
      pipelining: 1
    });
    this.method = options.method || 'GET';
    this.headers = options.headers || {};
    this.body = options.body || null;
    this.scenario = loadScenario(options.scenario);
  }

  async request() {
    const route = selectRoute(this.scenario);
    const method = (route && route.method) || this.method;
    const headers = { ...this.headers, ...((route && route.headers) || {}) };
    let requestBody = route && route.body !== undefined ? route.body : this.body;
    if (requestBody && typeof requestBody !== 'string' && !Buffer.isBuffer(requestBody)) {
      requestBody = JSON.stringify(requestBody);
      if (!headers['content-type'] && !headers['Content-Type']) headers['content-type'] = 'application/json';
    }
    const start = process.hrtime.bigint();
    try {
      const { statusCode, body: responseBody } = await this.pool.request({
        path: route ? new URL(route.path, this.url).pathname + new URL(route.path, this.url).search : this.url.pathname + this.url.search,
        method,
        headers,
        body: requestBody
      });

      // Consume body to free up the connection
      await responseBody.dump();

      const end = process.hrtime.bigint();
      const durationMs = Number(end - start) / 1e6;

      return {
        success: statusCode < 400,
        statusCode,
        latency: durationMs
      };
    } catch (err) {
      const end = process.hrtime.bigint();
      const durationMs = Number(end - start) / 1e6;

      logger.debug(`Request failed: ${err.message}`);

      return {
        success: false,
        error: err.message,
        latency: durationMs,
        statusCode: 0
      };
    }
  }

  async close() {
    await this.pool.close();
  }
}

module.exports = Requester;
