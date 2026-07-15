# Loopback Load Tester

A focused command-line tool for local and distributed HTTP load testing. It supports multiple CPU workers, weighted YAML/JSON scenarios, latency and server-error thresholds, authentication headers, and JSON reports.

> Only test systems you own or have explicit permission to test. Start with a small number of connections and increase the load gradually.

## Requirements

- Node.js 18 or newer
- npm

## Install

Clone the repository and install its dependencies:

```bash
git clone https://github.com/AndrixNg1/Loopback-Load-Tester.git
cd Loopback-Load-Tester
npm install
npm link
```

`npm link` makes the `loopback-load` command available locally. You can also replace `loopback-load` in the examples below with `node src/cli.js`.

## Quick start

Run a ten-second test with 20 concurrent connections:

```bash
loopback-load run \
  --url http://127.0.0.1:3000/api \
  --connections 20 \
  --duration 10
```

Show all commands and options:

```bash
loopback-load --help
loopback-load run --help
```

The old option-only syntax remains supported for compatibility:

```bash
loopback-load --mode local --url http://127.0.0.1:3000/api
```

## Local tests

Use more than one local process with `--workers`. `--connections` applies to each process, so the total concurrency is `workers × connections`.

```bash
loopback-load run \
  --url http://127.0.0.1:3000 \
  --workers 4 \
  --connections 25 \
  --warm-up 5 \
  --ramp-up 15 \
  --duration 30
```

Warm-up traffic is excluded from the final metrics. Ramp-up and steady-state traffic are included.

## Scenarios

A scenario selects weighted routes relative to `--url`:

```yaml
name: Basic API test
routes:
  - method: GET
    path: /health
    weight: 3

  - method: POST
    path: /sessions
    weight: 1
    headers:
      Content-Type: application/json
    body:
      email: test@example.com
      password: change-me
```

Run it with:

```bash
loopback-load run \
  --url http://127.0.0.1:3000 \
  --scenario examples/scenario-basic.yaml
```

Route headers override global headers. Both YAML and JSON files are accepted.

## Headers and authentication

Pass a Bearer token directly:

```bash
loopback-load run --url http://127.0.0.1:3000 --bearer "$API_TOKEN"
```

Or load headers from a JSON object:

```json
{
  "Content-Type": "application/json",
  "X-Test-Run": "local"
}
```

```bash
loopback-load run --url http://127.0.0.1:3000 --headers-file headers.json
```

Authorization values are redacted from the generated report.

## Thresholds and reports

Every run writes a stable JSON report to `report.json` by default. Change the path with `--output`.

```bash
loopback-load run \
  --url http://127.0.0.1:3000 \
  --threshold-p95 500 \
  --threshold-5xx 1 \
  --output reports/api.json
```

The command exits with status `1` when p95 latency or the percentage of HTTP 5xx responses exceeds its threshold. This makes the CLI suitable for CI checks.

## Distributed mode

Start the coordinator on the master machine:

```bash
loopback-load master \
  --url http://10.0.0.20:3000 \
  --port 7777 \
  --expected-workers 2 \
  --connections 50 \
  --duration 30
```

Connect each load-generating machine:

```bash
loopback-load worker --master-url http://10.0.0.10:7777 --name worker-a
```

The test begins three seconds after the expected number of workers connects. The target URL must be reachable from every worker. Protect port `7777` with a private network or firewall; this coordination protocol does not provide authentication or TLS.

## Environment configuration

Copy the provided template if you prefer environment variables:

```bash
cp .env.example .env
```

| Variable | CLI equivalent | Default |
| --- | --- | --- |
| `TARGET_URL` | `--url` | required |
| `CONNECTIONS` | `--connections` | `20` |
| `DURATION_SECONDS` | `--duration` | `10` |
| `RAMP_UP_SECONDS` | `--ramp-up` | `0` |
| `WARM_UP_SECONDS` | `--warm-up` | `0` |
| `AUTH_BEARER` | `--bearer` | empty |
| `HEADERS_FILE` | `--headers-file` | empty |
| `THRESHOLD_P95` | `--threshold-p95` | `800` |
| `THRESHOLD_5XX` | `--threshold-5xx` | `1` |
| `MASTER_PORT` | `--port` | `7777` |
| `EXPECTED_WORKERS` | `--expected-workers` | `1` |
| `MASTER_URL` | `--master-url` | empty |
| `OUTPUT_FILE` | `--output` | `report.json` |

CLI options take precedence over environment variables.

## Development

```bash
npm install
npm test
npm run check
npm pack --dry-run
```

Generated reports, `.env`, dependencies, coverage output, and package archives are ignored by Git.

## License

Released under the [MIT License](LICENSE).
