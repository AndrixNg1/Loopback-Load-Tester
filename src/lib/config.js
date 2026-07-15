const fs = require('fs');
const path = require('path');
const dotenv = require('dotenv');

dotenv.config({ quiet: true });

function integer(value, name, minimum = 0) {
  const parsed = Number.parseInt(value, 10);
  if (!Number.isInteger(parsed) || parsed < minimum) {
    throw new Error(`${name} must be an integer greater than or equal to ${minimum}`);
  }
  return parsed;
}

function number(value, name, minimum = 0) {
  const parsed = Number(value);
  if (!Number.isFinite(parsed) || parsed < minimum) {
    throw new Error(`${name} must be a number greater than or equal to ${minimum}`);
  }
  return parsed;
}

function loadHeaders(filePath) {
  if (!filePath) return {};
  const absolutePath = path.resolve(filePath);
  const headers = JSON.parse(fs.readFileSync(absolutePath, 'utf8'));
  if (!headers || Array.isArray(headers) || typeof headers !== 'object') {
    throw new Error('headers file must contain a JSON object');
  }
  return headers;
}

function normalizeOptions(options, mode) {
  const headers = loadHeaders(options.headersFile);
  if (options.bearer) headers.authorization = `Bearer ${options.bearer}`;

  const config = {
    ...options,
    mode,
    url: options.url || process.env.TARGET_URL,
    connections: integer(options.connections, 'connections', 1),
    duration: integer(options.duration, 'duration', 1),
    rampUp: integer(options.rampUp, 'ramp-up'),
    warmUp: integer(options.warmUp, 'warm-up'),
    workers: integer(options.workers, 'workers', 1),
    port: integer(options.port ?? process.env.MASTER_PORT ?? 7777, 'port', 1),
    expectedWorkers: integer(options.expectedWorkers ?? process.env.EXPECTED_WORKERS ?? 1, 'expected-workers', 1),
    thresholdP95: number(options.thresholdP95, 'threshold-p95'),
    threshold5xx: number(options.threshold5xx, 'threshold-5xx'),
    headers
  };

  if ((mode === 'local' || mode === 'master') && !config.url) {
    throw new Error('a target URL is required');
  }
  if (config.url) new URL(config.url);
  if (mode === 'worker' && !config.masterUrl) {
    throw new Error('--master-url is required');
  }
  return config;
}

module.exports = { normalizeOptions };
