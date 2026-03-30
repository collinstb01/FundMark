# FundMark

Backend service that normalizes **private fund performance** from public pension disclosures (FOIA-style public data), stores it in PostgreSQL, and exposes it over **HTTP** as a [Model Context Protocol (MCP)](https://modelcontextprotocol.io/) server.

There is no bundled web UI; clients connect via MCP (e.g. AI tools) or by calling the HTTP endpoints below.

## What it does

- **Ingest** — Fetches and parses holdings from CalPERS, Oregon PERS, CalSTRS, WSIB, and Florida SBA; validates, deduplicates, optionally enriches from SEC Form D, and upserts into Postgres.
- **Serve** — Express app with MCP streamable HTTP on `/mcp`, plus `get_fund_benchmarks`, `lookup_fund`, and `list_available_benchmarks` tools backed by the database.
- **Benchmarks** — Aggregates by strategy × vintage × geography; quartiles are only computed when there are at least 15 funds in a cell.

## Requirements

- Node.js 18+ recommended
- PostgreSQL (`DATABASE_URL`)

## Setup

```bash
npm install
```

Create a `.env` file (not committed):

```env
DATABASE_URL=postgresql://user:password@host:5432/database
```

For Railway Postgres, the app enables SSL when `DATABASE_URL` contains `railway`.

## Run the server

```bash
npm run dev
# or
npm start
```

- **Health:** `GET /health`
- **MCP:** `POST /mcp` (and `GET /mcp` with session) — JSON-RPC per MCP streamable HTTP; requires initialize flow and `mcp-session-id` header on subsequent requests.

Default port: `3000`, or `PORT` from the environment.

## Load data (ingestion)

Run after the database exists and `DATABASE_URL` is set:

```bash
npm run ingest
```

This creates tables if needed, pulls all configured sources, validates, enriches when possible, and upserts funds.

## Scripts

| Script            | Description                                      |
| ----------------- | ------------------------------------------------ |
| `npm run dev`     | Start MCP server with `dotenv`                   |
| `npm start`       | Same as dev (production entry)                   |
| `npm run ingest`  | Full ingestion pipeline into Postgres            |
| `npm run test:*`  | Parser / strategy / ingest tests                 |

## Deploy (e.g. Railway)

- **Build:** leave default or use `npm ci`
- **Start:** `npm start`
- Set **`DATABASE_URL`** to your Postgres service

Ensure `tsx` is available in production (it is a devDependency; if installs omit dev deps, move `tsx` to `dependencies` or compile with `tsc` and run with `node`).

## License

MIT
