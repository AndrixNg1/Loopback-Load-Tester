const chalk = require('chalk');

let settings = { silent: false, verbose: false };
const labels = {
  info: chalk.blue('INFO'), warn: chalk.yellow('WARN'), error: chalk.red('ERROR'),
  debug: chalk.magenta('DEBUG'), success: chalk.green('SUCCESS')
};

function write(level, message) {
  if (settings.silent && level !== 'error') return;
  if (level === 'debug' && !settings.verbose) return;
  const output = `[${new Date().toISOString()}] ${labels[level]} ${message}`;
  (level === 'error' ? console.error : console.log)(output);
}

module.exports = {
  configure(options = {}) { settings = { ...settings, ...options }; },
  info: (message) => write('info', message),
  warn: (message) => write('warn', message),
  error: (message) => write('error', message),
  debug: (message) => write('debug', message),
  success: (message) => write('success', message)
};
