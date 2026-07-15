function percentile(values, rank) {
  if (!values || values.length === 0) return 0;
  const sorted = [...values].sort((a, b) => a - b);
  return sorted[Math.min(sorted.length - 1, Math.ceil((rank / 100) * sorted.length) - 1)];
}

function validateMetrics(metrics, config) {
  const p95 = percentile(metrics.latencies, 95);
  const serverErrors = Object.entries(metrics.statusCodes || {})
    .filter(([code]) => /^5\d\d$/.test(code))
    .reduce((sum, [, count]) => sum + count, 0);
  const errorRate5xx = metrics.total ? (serverErrors / metrics.total) * 100 : 0;
  const failures = [];
  if (p95 > config.thresholdP95) failures.push(`p95 ${p95.toFixed(2)}ms > ${config.thresholdP95}ms`);
  if (errorRate5xx > config.threshold5xx) failures.push(`5xx ${errorRate5xx.toFixed(2)}% > ${config.threshold5xx}%`);
  return { p95, errorRate5xx, failures, failed: failures.length > 0 };
}

module.exports = { validateMetrics, percentile };
