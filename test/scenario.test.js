const test = require('node:test');
const assert = require('node:assert/strict');
const path = require('node:path');
const { loadScenario, selectRoute } = require('../src/scenarios/loader');

test('loads a YAML scenario and selects a route', () => {
  const scenario = loadScenario(path.join(__dirname, '..', 'examples', 'scenario-basic.yaml'));
  assert.ok(scenario.routes.length > 0);
  assert.ok(selectRoute(scenario).path);
});
