const fs = require('fs');
const path = require('path');
const yaml = require('js-yaml');
const logger = require('../lib/logger');

function loadScenario(filePath) {
  if (!filePath) return null;

  try {
    const absolutePath = path.resolve(filePath);
    const content = fs.readFileSync(absolutePath, 'utf8');
    const ext = path.extname(filePath).toLowerCase();

    let data;
    if (ext === '.yaml' || ext === '.yml') {
      data = yaml.load(content);
    } else {
      data = JSON.parse(content);
    }

    if (!data.routes || !Array.isArray(data.routes)) {
      throw new Error('Scenario file must contain a "routes" array');
    }

    // Normalize routes and calculate weights for weighted random selection
    let totalWeight = 0;
    const routes = data.routes.map(route => {
      const weight = route.weight || 1;
      totalWeight += weight;
      return {
        ...route,
        weight,
        method: route.method || 'GET',
        path: route.path || '/'
      };
    });

    return {
      name: data.name || 'Default Scenario',
      routes,
      totalWeight
    };
  } catch (err) {
    logger.error(`Failed to load scenario: ${err.message}`);
    return null;
  }
}

function selectRoute(scenario) {
  if (!scenario || !scenario.routes.length) return null;

  let random = Math.random() * scenario.totalWeight;
  for (const route of scenario.routes) {
    if (random < route.weight) return route;
    random -= route.weight;
  }
  return scenario.routes[0];
}

module.exports = { loadScenario, selectRoute };
