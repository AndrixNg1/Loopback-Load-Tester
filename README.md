# Loopback Load Tester

Loopback Load Tester is a small localhost-only load testing tool.

It sends bounded high-volume `GET` traffic to another API already running on the same machine so you can observe latency, throughput, errors, and breaking points under pressure.

This repository is **v1**.

## What It Simulates

Loopback Load Tester simulates:

- many concurrent `GET` requests from a single local machine
- increasing pressure on a specific local API route
- the behavior of an API under moderate to heavy request volume

It does **not** simulate:

- a real distributed attack
- packet floods or network-layer attacks
- botnets or multi-origin traffic
- bypass techniques
- remote targets on the internet

## Safety Model

This tool is intentionally restricted.

- The target host must be `127.0.0.1`, `localhost`, or `::1`
- Any non-local target is rejected before the test starts
- The tool performs a preflight request before the load test
- The tool only sends `GET` requests in v1

The goal is defensive observation on infrastructure you control locally.

## Features

- localhost-only target validation
- simple `.env` configuration
- preflight health check before starting the run
- latency, throughput, status code, and error reporting
- works well for observing Dockerized local APIs such as NestJS, Express, FastAPI, and similar services

## Requirements

- Node.js 18+
- npm

## Installation

```bash
npm install
cp .env.example .env
```

## Quick Start

1. Start the local API you want to observe.
2. Check that the route responds with `curl`.
3. Configure [`.env`](./.env).
4. Run:

```bash
npm run attack
```

## Configuration

Edit [`.env`](./.env):

```env
TARGET_HOST=127.0.0.1
TARGET_PORT=3000
TARGET_PATH=/api
CONNECTIONS=20
DURATION_SECONDS=10
```

### Variables

- `TARGET_HOST`: must stay on `127.0.0.1`, `localhost`, or `::1`
- `TARGET_PORT`: local API port
- `TARGET_PATH`: route to test, query string included if needed
- `CONNECTIONS`: number of concurrent connections
- `DURATION_SECONDS`: duration of the run

## Generic Usage Flow

1. Start the local API you want to observe.
2. Choose one route to test.
3. Verify that the route works with `curl`.
4. Put the target route in [`.env`](./.env).
5. Run the load test.

Example:

```bash
curl http://127.0.0.1:3000/your-route
```

Then set:

```env
TARGET_HOST=127.0.0.1
TARGET_PORT=3000
TARGET_PATH=/your-route
CONNECTIONS=25
DURATION_SECONDS=15
```

And run:

```bash
npm run attack
```

## Suggested Test Levels

### Level 1

Use this for a first safe observation:

```env
CONNECTIONS=10
DURATION_SECONDS=10
```

### Level 2

Use this to observe moderate stress:

```env
CONNECTIONS=25
DURATION_SECONDS=15
```

### Level 3

Use this to observe stronger pressure:

```env
CONNECTIONS=50
DURATION_SECONDS=15
```

### Level 4

Use this only if you want to find the breaking point of a local route you control:

```env
CONNECTIONS=100
DURATION_SECONDS=15
```

## Understanding the Output

The tool prints:

- latency percentiles
- request rate (`Req/Sec`)
- bytes read per second
- counts for `2xx`, `3xx`, `4xx`, and `5xx`
- client-side errors and timeouts

### How to Read It

- If latency goes up but responses stay successful, the API is degrading but still serving traffic.
- If `5xx` starts appearing, the application is failing under pressure.
- If timeouts appear, the route is no longer keeping up with incoming concurrency.
- If only one route breaks while others stay stable, that route is likely your hotspot.

## What to Observe on the API Side

Open separate terminals while the test is running:

```bash
docker logs -f <your-api-container>
docker stats <your-api-container> <your-db-container>
```

If your API uses PostgreSQL:

```bash
docker exec -it <your-db-container> psql -U <db-user> -d <db-name> -c "
select state, count(*)
from pg_stat_activity
where datname = '<db-name>'
group by state
order by state;
"
```

## Preflight Behavior

Before sending load, the tool checks that the target route is reachable.

If the API is down or the port/path is wrong, you get a clear message such as:

```text
Preflight failed: http://127.0.0.1:3000/api is unreachable. Start the local API first or check TARGET_PORT/TARGET_PATH.
```

## Limits in v1

- `GET` only
- no custom headers
- no request body support
- no authentication helper
- no scenario file
- no distributed workers
- localhost only by design

## Why the Name "Loopback"

The tool only targets loopback addresses.

That is the core safety rule of the project and the reason for the name.

## License

This project is released under the MIT License. See [LICENSE](./LICENSE).
