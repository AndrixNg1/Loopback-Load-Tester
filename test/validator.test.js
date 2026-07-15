const test = require('node:test');
const assert = require('node:assert/strict');
const { percentile, validateMetrics } = require('../src/scenarios/validator');

test('percentile handles empty and ordered values', () => {
  assert.equal(percentile([], 95), 0);
  assert.equal(percentile([50, 10, 40, 20, 30], 50), 30);
  assert.equal(percentile([50, 10, 40, 20, 30], 95), 50);
});

test('threshold validation uses CLI configuration names', () => {
  const result = validateMetrics(
    { total: 10, latencies: [100, 200], statusCodes: { 200: 9, 500: 1 } },
    { thresholdP95: 150, threshold5xx: 5 }
  );
  assert.equal(result.failed, true);
  assert.equal(result.failures.length, 2);
});
