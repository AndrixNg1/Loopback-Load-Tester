const fs = require('fs');
const stringify = require('json-stable-stringify');
const path = require('path');

function exportReport(report, filePath = 'report.json') {
  const data = {
    timestamp: new Date().toISOString(),
    ...report
  };

  const absolutePath = path.resolve(filePath);
  fs.mkdirSync(path.dirname(absolutePath), { recursive: true });
  fs.writeFileSync(absolutePath, stringify(data, { space: 2 }));
}

module.exports = { exportReport };
