#!/usr/bin/env node

const { Command } = require('commander');
const pkg = require('../package.json');
const { normalizeOptions } = require('./lib/config');
const logger = require('./lib/logger');
const runCluster = require('./engine/cluster');
const startMaster = require('./master/server');
const startWorker = require('./worker/client');
const aggregator = require('./master/aggregator');
const consoleReporter = require('./reporter/console');
const { exportReport } = require('./reporter/json');
const { validateMetrics } = require('./scenarios/validator');

function defaults() {
  return {
    connections: process.env.CONNECTIONS || '20', duration: process.env.DURATION_SECONDS || '10',
    rampUp: process.env.RAMP_UP_SECONDS || '0', warmUp: process.env.WARM_UP_SECONDS || '0',
    workers: '1', port: process.env.MASTER_PORT || '7777',
    expectedWorkers: process.env.EXPECTED_WORKERS || '1',
    thresholdP95: process.env.THRESHOLD_P95 || '800', threshold5xx: process.env.THRESHOLD_5XX || '1',
    output: process.env.OUTPUT_FILE || 'report.json'
  };
}

function addTestOptions(command, { requireUrl = false } = {}) {
  const d = defaults();
  const url = requireUrl
    ? command.requiredOption('--url <url>', 'target base URL', process.env.TARGET_URL)
    : command.option('--url <url>', 'target base URL', process.env.TARGET_URL);
  return url
    .option('-c, --connections <number>', 'concurrent connections', d.connections)
    .option('-d, --duration <seconds>', 'steady-state duration', d.duration)
    .option('--ramp-up <seconds>', 'ramp-up duration', d.rampUp)
    .option('--warm-up <seconds>', 'warm-up duration', d.warmUp)
    .option('-w, --workers <number>', 'local CPU workers', d.workers)
    .option('-X, --method <method>', 'HTTP method', 'GET')
    .option('--body <json>', 'request body')
    .option('--headers-file <path>', 'JSON headers file', process.env.HEADERS_FILE)
    .option('--bearer <token>', 'Bearer token', process.env.AUTH_BEARER)
    .option('-s, --scenario <path>', 'JSON or YAML scenario')
    .option('--threshold-p95 <ms>', 'maximum p95 latency', d.thresholdP95)
    .option('--threshold-5xx <percent>', 'maximum 5xx rate', d.threshold5xx)
    .option('-o, --output <path>', 'JSON report path', d.output)
    .option('--silent', 'hide informational logs', process.env.SILENT === 'true')
    .option('--verbose', 'show debug logs', process.env.VERBOSE === 'true');
}

function finish(report, config) {
  const validation = validateMetrics(report.raw, config);
  const status = validation.failed ? 'FAIL' : 'PASS';
  consoleReporter.stop();
  consoleReporter.printSummary({ ...report, status });
  const safeHeaders = { ...config.headers };
  if (safeHeaders.authorization || safeHeaders.Authorization) safeHeaders.authorization = '[redacted]';
  delete safeHeaders.Authorization;
  exportReport({ ...report, validation, config: { ...config, bearer: undefined, headers: safeHeaders }, status }, config.output);
  process.exitCode = validation.failed ? 1 : 0;
}

async function runLocal(options) {
  const config = normalizeOptions(options, 'local');
  logger.configure(config);
  aggregator.reset();
  process.on('cluster:snapshot', (metrics) => {
    aggregator.update(metrics);
    consoleReporter.update(aggregator.aggregated);
  });
  process.once('cluster:done', (metrics) => {
    aggregator.update(metrics);
    finish(aggregator.getFinalReport(), config);
  });
  consoleReporter.start(config.duration);
  runCluster(config);
}

async function runMaster(options) {
  const config = normalizeOptions(options, 'master');
  logger.configure(config);
  aggregator.reset();
  process.on('aggregator:update', (metrics) => consoleReporter.update(metrics));
  process.once('master:allDone', () => finish(aggregator.getFinalReport(), config));
  consoleReporter.start(config.duration);
  await startMaster(config);
}

async function runWorker(options) {
  const config = normalizeOptions({ ...defaults(), ...options }, 'worker');
  logger.configure(config);
  startWorker(config);
}

async function main(argv = process.argv) {
  if (process.env.LOOPBACK_LOAD_CLUSTER_CONFIG) {
    return runCluster(JSON.parse(process.env.LOOPBACK_LOAD_CLUSTER_CONFIG));
  }

  const program = new Command().name('loopback-load').description('Local and distributed HTTP load testing CLI').version(pkg.version);
  addTestOptions(program.command('run').description('run a load test on this machine')).action(runLocal);
  addTestOptions(program.command('master').description('coordinate remote workers'))
    .option('-p, --port <port>', 'coordination port', defaults().port)
    .option('--expected-workers <number>', 'workers required before start', defaults().expectedWorkers)
    .action(runMaster);
  program.command('worker').description('connect this machine to a master')
    .requiredOption('-m, --master-url <url>', 'master URL')
    .option('--name <name>', 'worker display name')
    .option('--silent').option('--verbose').action(runWorker);

  // Preserve the v2 pre-release syntax: --mode local --url ...
  if (argv.length > 2 && argv[2].startsWith('-') && !['-h', '--help', '-V', '--version'].includes(argv[2])) {
    const modeIndex = argv.indexOf('--mode');
    const mode = modeIndex >= 0 ? argv[modeIndex + 1] : 'local';
    const cleaned = modeIndex >= 0
      ? argv.filter((_, index) => index !== modeIndex && index !== modeIndex + 1)
      : [...argv];
    cleaned.splice(2, 0, mode === 'local' ? 'run' : mode);
    argv = cleaned;
  }
  await program.parseAsync(argv);
}

main().catch((error) => {
  logger.error(error.message);
  process.exitCode = 1;
});

module.exports = { main };
