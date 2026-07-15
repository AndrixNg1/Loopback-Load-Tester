# Loopback Load Tester

Loopback Load Tester is a Node.js command-line application for measuring how an HTTP API behaves under concurrent traffic. It can generate load from one computer, use several CPU processes on that computer, or coordinate multiple load-generating machines from a central master.

The project is designed to answer practical performance questions:

- How many requests per second can an API sustain?
- How does response time change when concurrency increases?
- Which HTTP status codes appear under pressure?
- Does the service remain within an acceptable p95 latency?
- At what load does the API begin returning server errors?
- Does a realistic mix of routes behave differently from a single endpoint?

It is a load-testing tool, not an application monitoring platform or a network-level traffic generator. It sends ordinary HTTP requests through [`undici`](https://undici.nodejs.org/) and reports measurements observed by the load generators.

> [!WARNING]
> Only run load tests against systems you own or have explicit permission to test. A load test can exhaust CPU, memory, database connections, or network capacity. Begin with low concurrency and a short duration.

## What the project provides

- A clear CLI with `run`, `master`, and `worker` commands
- Concurrent HTTP requests with configurable method, headers, and body
- Multiple local Node.js processes for using more than one CPU core
- Warm-up, ramp-up, and steady-state phases
- Weighted YAML or JSON scenarios for testing several routes
- Bearer authentication and headers loaded from a JSON file
- Local and multi-machine distributed execution
- Live request and error counters
- Total requests, throughput, success rate, status codes, p50, p95, and p99 latency
- Configurable p95 and HTTP 5xx thresholds
- A non-zero exit code when a threshold fails
- Stable JSON reports for automation and later analysis

## How it works

In local mode, the CLI creates one or more Node.js cluster processes. Each process owns an HTTP connection pool and runs the configured number of concurrent request loops. Results from all processes are aggregated before the final report is written.

```text
                         local mode

  loopback-load run
          │
          ├── cluster process 1 ── HTTP connection pool ──┐
          ├── cluster process 2 ── HTTP connection pool ──┼── target API
          └── cluster process N ── HTTP connection pool ──┘
                       │
                       └── aggregated metrics → report.json
```

In distributed mode, a master waits for a configured number of workers. It sends the same test configuration and a synchronized start time to every connected worker. Each worker runs its own local cluster and streams metrics back to the master.

```text
                         distributed mode

                           master
                    configuration + clock
                    metrics aggregation
                     /        |        \
                worker A  worker B  worker C
                    |         |         |
                    └─────────┴─────────┴────── target API
```

The master coordinates the test; it does not generate target traffic itself.

## Understanding concurrency

`--connections` is the number of simultaneous request loops in each local cluster process. `--workers` is the number of local cluster processes.

For a local test:

```text
approximate concurrency = workers × connections
```

For a distributed test where every machine uses the same configuration:

```text
approximate concurrency = machines × workers × connections
```

For example, three machines with two local workers and 25 connections can produce approximately 150 concurrent requests. This is why increasing both values should be done carefully.

## Requirements

- Node.js 18 or newer
- npm
- Network access from every load generator to the target API

## Installation

Clone the repository and install the exact dependencies from the lockfile:

```bash
git clone https://github.com/AndrixNg1/Loopback-Load-Tester.git
cd Loopback-Load-Tester
npm ci
npm link
```

`npm link` installs the `loopback-load` command from the local checkout. Without linking, use `node src/cli.js` in place of `loopback-load` in every example.

Confirm that the CLI is available:

```bash
loopback-load --version
loopback-load --help
```

## First load test

Start with a route you control and verify it normally first:

```bash
curl http://127.0.0.1:3000/health
```

Then run a small ten-second test:

```bash
loopback-load run \
  --url http://127.0.0.1:3000/health \
  --connections 10 \
  --duration 10
```

The CLI displays live progress and writes `report.json` when the run finishes.

## Test phases

A run can contain three phases:

1. **Warm-up** uses one connection to prepare the application, connection pool, and runtime. Warm-up requests are excluded from final metrics.
2. **Ramp-up** progressively adds request loops until `--connections` is reached. Ramp-up requests are included in final metrics.
3. **Steady state** keeps the full configured concurrency active for `--duration` seconds. These requests are included in final metrics.

Example:

```bash
loopback-load run \
  --url http://127.0.0.1:3000/api \
  --workers 2 \
  --connections 25 \
  --warm-up 5 \
  --ramp-up 15 \
  --duration 30
```

This command creates two local processes. Each one warms up for five seconds, ramps toward 25 connections for 15 seconds, and then runs at 25 connections for 30 seconds.

## CLI commands

### `loopback-load run`

Runs a test on the current machine.

```text
--url <url>                  Target URL (required unless TARGET_URL is set)
-c, --connections <number>  Concurrent request loops per local worker
-d, --duration <seconds>    Steady-state duration
-w, --workers <number>      Local cluster processes
--warm-up <seconds>         Warm-up duration
--ramp-up <seconds>         Progressive ramp-up duration
-X, --method <method>       Default HTTP method
--body <value>              Default request body
--headers-file <path>       JSON object containing global headers
--bearer <token>            Add an Authorization Bearer header
-s, --scenario <path>       YAML or JSON scenario file
--threshold-p95 <ms>        Maximum accepted p95 latency
--threshold-5xx <percent>   Maximum accepted percentage of 5xx responses
-o, --output <path>         JSON report destination
--silent                    Hide informational logs
--verbose                   Display debug logs
```

### `loopback-load master`

Starts a coordinator for a distributed test. It accepts the test options above plus:

```text
-p, --port <port>                 Coordination server port
--expected-workers <number>       Workers required before the test starts
```

### `loopback-load worker`

Connects one load-generating machine to a master.

```text
-m, --master-url <url>      Master URL, including protocol and port
--name <name>               Human-readable worker name
--silent                    Hide informational logs
--verbose                   Display debug logs
```

Use the built-in help for the definitive option list:

```bash
loopback-load run --help
loopback-load master --help
loopback-load worker --help
```

The option-only v2 preview syntax remains available for compatibility:

```bash
loopback-load --mode local --url http://127.0.0.1:3000/health
```

## HTTP methods, bodies, and headers

Run a POST test with a JSON body:

```bash
loopback-load run \
  --url http://127.0.0.1:3000/sessions \
  --method POST \
  --headers-file headers.json \
  --body '{"email":"test@example.com","password":"change-me"}'
```

Example `headers.json`:

```json
{
  "Content-Type": "application/json",
  "X-Test-Run": "local-performance-check"
}
```

For Bearer authentication:

```bash
loopback-load run \
  --url http://127.0.0.1:3000/profile \
  --bearer "$API_TOKEN"
```

The authorization header is redacted in the JSON report. Avoid placing real credentials directly in scenario files or committing header files containing secrets.

## Weighted scenarios

A scenario models a mixture of routes instead of repeating one request. Every route has a weight. A route with weight `6` is selected approximately six times as often as a route with weight `1`.

```yaml
name: Storefront traffic
routes:
  - method: GET
    path: /products
    weight: 6

  - method: GET
    path: /products/featured
    weight: 3

  - method: POST
    path: /cart/items
    weight: 1
    headers:
      Content-Type: application/json
    body:
      productId: 42
      quantity: 1
```

Run the scenario against a base URL:

```bash
loopback-load run \
  --url http://127.0.0.1:3000 \
  --scenario scenarios/storefront.yaml \
  --connections 20 \
  --duration 30
```

Scenario paths are resolved relative to `--url`. Route methods, bodies, and headers override their command-line defaults. Object bodies are serialized as JSON automatically. Both `.yaml`/`.yml` and `.json` files are supported.

Ready-to-edit examples are available in [`examples/`](examples/).

## Thresholds and exit codes

Thresholds turn performance expectations into automated pass/fail checks:

```bash
loopback-load run \
  --url http://127.0.0.1:3000/api \
  --threshold-p95 500 \
  --threshold-5xx 1
```

- `--threshold-p95 500` fails when p95 latency is above 500 milliseconds.
- `--threshold-5xx 1` fails when more than 1% of all requests receive an HTTP 5xx response.
- A passing run exits with status `0`.
- A failed threshold exits with status `1`.
- HTTP 4xx and transport errors reduce the displayed success rate, but only the configured p95 and 5xx thresholds determine the final pass/fail status.

Example CI usage:

```bash
loopback-load run \
  --url "$STAGING_API_URL/health" \
  --connections 10 \
  --duration 15 \
  --threshold-p95 300 \
  --threshold-5xx 0
```

## Metrics

The final summary and JSON report contain:

| Metric | Meaning |
| --- | --- |
| Total requests | All completed HTTP attempts included in measured phases |
| Requests/second | Total requests divided by measured elapsed time |
| Success rate | Percentage of responses with a status below 400 |
| Status codes | Count grouped by exact HTTP status; transport failures use `ERROR` |
| p50 latency | Median client-observed request duration |
| p95 latency | Duration below which 95% of measured requests completed |
| p99 latency | Duration below which 99% of measured requests completed |

Latency is measured on the load-generating machine and includes the time required to receive and consume the response body. It is not the same as server-only processing time.

## JSON reports

The default destination is `report.json`. Parent directories are created automatically:

```bash
loopback-load run \
  --url http://127.0.0.1:3000/api \
  --output reports/api-baseline.json
```

The report contains the timestamp, sanitized configuration, raw counters, aggregated metrics, validation results, and final `PASS` or `FAIL` status. Generated reports are ignored by Git by default.

## Distributed testing

Assume:

- the target API is reachable at `http://10.0.0.20:3000` from every worker;
- the master is reachable at `http://10.0.0.10:7777`;
- two worker machines will generate traffic.

Start the master:

```bash
loopback-load master \
  --url http://10.0.0.20:3000 \
  --port 7777 \
  --expected-workers 2 \
  --workers 2 \
  --connections 25 \
  --duration 30 \
  --output reports/distributed.json
```

Start a worker on each load-generating machine:

```bash
loopback-load worker \
  --master-url http://10.0.0.10:7777 \
  --name worker-a
```

```bash
loopback-load worker \
  --master-url http://10.0.0.10:7777 \
  --name worker-b
```

When both workers have registered, the master broadcasts a start time three seconds in the future. It continuously combines worker snapshots and writes the final report after every registered worker completes.

### Distributed-mode security

The coordination server currently has no authentication, authorization, or TLS. Run it only on a trusted private network or behind appropriate firewall and VPN rules. Do not expose the coordination port directly to the public internet.

## Environment configuration

Copy the template to configure defaults without repeating options:

```bash
cp .env.example .env
```

| Environment variable | CLI equivalent | Built-in default |
| --- | --- | --- |
| `TARGET_URL` | `--url` | required |
| `CONNECTIONS` | `--connections` | `20` |
| `DURATION_SECONDS` | `--duration` | `10` |
| `RAMP_UP_SECONDS` | `--ramp-up` | `0` |
| `WARM_UP_SECONDS` | `--warm-up` | `0` |
| `AUTH_BEARER` | `--bearer` | empty |
| `HEADERS_FILE` | `--headers-file` | empty |
| `THRESHOLD_P95` | `--threshold-p95` | `800` ms |
| `THRESHOLD_5XX` | `--threshold-5xx` | `1`% |
| `MASTER_PORT` | `--port` | `7777` |
| `EXPECTED_WORKERS` | `--expected-workers` | `1` |
| `MASTER_URL` | `--master-url` | empty |
| `OUTPUT_FILE` | `--output` | `report.json` |
| `SILENT` | `--silent` | `false` |
| `VERBOSE` | `--verbose` | `false` |

Explicit CLI options take precedence over environment values.

## Reading the results

- Rising p95/p99 with a stable success rate usually means the service is slowing down but still serving traffic.
- HTTP 5xx responses indicate that the server or an upstream dependency is failing requests.
- HTTP 4xx responses often indicate invalid test data, missing authentication, or rate limiting.
- `ERROR` means the client did not obtain an HTTP response, for example because of a refused connection or network failure.
- A low client success rate with no 5xx responses should be investigated even if the configured thresholds pass.
- Compare results with API, database, container, and infrastructure metrics to identify the actual bottleneck.

## Current limitations

- HTTP is the only supported application protocol; there is no native gRPC or WebSocket load generator.
- There is no fixed requests-per-second rate limiter; load is concurrency driven.
- Scenario variables, response extraction, cookies, and multi-step user sessions are not implemented.
- Workers use the same configuration; per-worker overrides are not implemented.
- The distributed coordination channel does not provide authentication or TLS.
- Latency samples are retained in memory to calculate percentiles, so extremely long or very high-volume tests can consume substantial memory.
- Reports are JSON only; there is no built-in HTML dashboard or historical database.

These limits are intentional to keep the CLI understandable and focused.

## Troubleshooting

### The command is not found

Run `npm link` from the project directory, or invoke the CLI with `node src/cli.js`.

### All requests are errors

Confirm the target URL from the same machine:

```bash
curl -i http://127.0.0.1:3000/health
```

Check the protocol, hostname, port, route, firewall, and whether the target listens outside its container or host.

### Workers cannot connect

Verify that the master listens on the configured port and that workers can reach it:

```bash
curl -i http://10.0.0.10:7777
```

An HTTP 404 still confirms that the TCP/HTTP server is reachable. Also verify firewall rules and that every worker uses the same master URL.

### The test is stronger than expected

Remember that concurrency is multiplied by the number of local processes and distributed machines. Reduce `--connections`, `--workers`, or the number of machines.

## Development and validation

```bash
npm ci
npm test
npm run check
npm pack --dry-run
```

The GitHub Actions workflow runs the checks on Node.js 18, 20, and 22. The repository ignores dependencies, `.env`, generated reports, coverage output, and package archives.

## Project structure

```text
src/
├── cli.js                 command definitions and execution flow
├── engine/                HTTP requester, phases, and local clustering
├── lib/                   configuration and logging
├── master/                coordination, synchronization, and aggregation
├── reporter/              console output and JSON export
├── scenarios/             scenario loading, route selection, thresholds
└── worker/                distributed worker client
```

## License

Loopback Load Tester is released under the [MIT License](LICENSE).
