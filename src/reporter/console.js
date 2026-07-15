const chalk = require('chalk');
const cliProgress = require('cli-progress');

class ConsoleReporter {
  constructor() {
    this.multibar = new cliProgress.MultiBar({
      clearOnComplete: false,
      hideCursor: true,
      format: '{bar} | {percentage}% | {value}/{total}s | {msg}'
    }, cliProgress.Presets.shades_grey);

    this.progressBar = null;
  }

  start(duration) {
    this.progressBar = this.multibar.create(duration, 0, { msg: 'Initializing...' });
    this.progressBar.setTotal(duration);
  }

  update(metrics) {
    if (this.progressBar) {
      const elapsed = metrics.startTime ? Math.min(this.progressBar.getTotal(), (Date.now() - metrics.startTime) / 1000) : 0;
      this.progressBar.update(elapsed, { msg: `Requests: ${metrics.total} | Errors: ${metrics.error}` });
    }
  }

  stop() {
    this.multibar.stop();
  }

  printSummary(report) {
    const { aggregated } = report;
    console.log('\n' + chalk.bold.cyan('=== Load Test Summary ==='));
    console.log(`${chalk.bold('Total Requests:')} ${aggregated.requests.total}`);
    console.log(`${chalk.bold('Throughput:')}     ${aggregated.requests.rate.toFixed(2)} req/sec`);
    console.log(`${chalk.bold('p95 Latency:')}    ${aggregated.latency.p95.toFixed(2)}ms`);
    console.log(`${chalk.bold('p99 Latency:')}    ${aggregated.latency.p99.toFixed(2)}ms`);
    console.log(`${chalk.bold('Success Rate:')}   ${aggregated.successRate.toFixed(2)}%`);

    console.log('\n' + chalk.bold('Status Codes:'));
    Object.entries(aggregated.status).forEach(([code, count]) => {
      let color = chalk.white;
      if (code.startsWith('2')) color = chalk.green;
      if (code.startsWith('4')) color = chalk.yellow;
      if (code.startsWith('5')) color = chalk.red;
      console.log(`  ${color(code)}: ${count}`);
    });
    console.log(chalk.bold.cyan('=========================\n'));
  }
}

module.exports = new ConsoleReporter();
