require("dotenv").config({ quiet: true });

const autocannon = require("autocannon");

main().catch((error) => {
  console.error(error.message);
  process.exitCode = 1;
});

async function main() {
  const config = getConfig();
  const url = `http://${config.targetHost}:${config.targetPort}${config.targetPath}`;

  await preflight(url);

  console.log(`Starting bounded localhost load test against ${url}`);
  console.log(
    `Connections=${config.connections}, duration=${config.durationSeconds}s`
  );

  const instance = autocannon({
    url,
    connections: config.connections,
    duration: config.durationSeconds,
    pipelining: 1,
    method: "GET",
    headers: {
      "x-load-test-purpose": "local-api-observation"
    }
  });

  autocannon.track(instance, {
    renderProgressBar: true,
    renderLatencyTable: true,
    renderResultsTable: true
  });

  instance.on("done", (result) => {
    console.log("\nLoad test finished.");
    console.log(`Requests total: ${result.requests.total}`);
    console.log(`Responses 2xx: ${result["2xx"] || 0}`);
    console.log(`Responses 3xx: ${result["3xx"] || 0}`);
    console.log(`Responses 4xx: ${result["4xx"] || 0}`);
    console.log(`Responses 5xx: ${result["5xx"] || 0}`);

    if (result.errors || result.timeouts) {
      console.log(`Errors: ${result.errors || 0}`);
      console.log(`Timeouts: ${result.timeouts || 0}`);
    }
  });
}

function getConfig() {
  return {
    targetHost: resolveLoopbackHost(process.env.TARGET_HOST || "127.0.0.1"),
    targetPort: toPositiveNumber(process.env.TARGET_PORT, 3000),
    targetPath: normalizePath(process.env.TARGET_PATH || "/api"),
    connections: clampNumber(process.env.CONNECTIONS, 20, 1, 200),
    durationSeconds: clampNumber(process.env.DURATION_SECONDS, 10, 1, 60)
  };
}

function resolveLoopbackHost(host) {
  if (host === "127.0.0.1" || host === "::1" || host === "localhost") {
    return host;
  }

  throw new Error("TARGET_HOST must stay on localhost for this tool.");
}

function normalizePath(pathValue) {
  if (!pathValue.startsWith("/")) {
    return `/${pathValue}`;
  }

  return pathValue;
}

function toPositiveNumber(value, fallback) {
  const parsed = Number(value);

  if (!Number.isFinite(parsed) || parsed <= 0) {
    return fallback;
  }

  return parsed;
}

function clampNumber(value, fallback, min, max) {
  const parsed = Number(value);

  if (!Number.isFinite(parsed)) {
    return fallback;
  }

  return Math.min(max, Math.max(min, parsed));
}

async function preflight(url) {
  let response;

  try {
    response = await fetch(url, {
      method: "GET",
      signal: AbortSignal.timeout(4000)
    });
  } catch (_error) {
    throw new Error(
      `Preflight failed: ${url} is unreachable. Start the local API first or check TARGET_PORT/TARGET_PATH.`
    );
  }

  if (!response) {
    throw new Error(`Preflight failed for ${url}.`);
  }
}
