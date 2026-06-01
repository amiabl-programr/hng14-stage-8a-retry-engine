# Retry Engine

A small HTTP service that takes an HTTP request, retries it on failure with exponential backoff and jitter, and tracks every attempt.

## Setup

```bash
pnpm install
```

## Development

```bash
pnpm dev       # Hot-reload dev server (tsx watch)
```

## Build & Start

```bash
pnpm build      # Compile TypeScript to dist/
pnpm start      # Run the compiled server
```

## Typecheck

```bash
pnpm typecheck
```

## Lint & Format

```bash
pnpm lint
pnpm format
```

## Test

```bash
pnpm test
```
## Project Structure

```
src/
├── app.ts                # Express app configuration
├── server.ts             # Entry point
├── routes/               # Route definitions
│   └── request.routes.ts
├── controllers/          # Request handlers
├── service/              # Business logic
├── worker/               # Background retry loop
├── db/                   # SQLite schema & connection
├── common/               # Shared utilities and types
└── config/               # Configuration
tests/                    # Test files
```


## API

### POST /request

Submit a URL to be called (with optional retry config).

```bash
curl -X POST http://localhost:3000/request \
  -H "Content-Type: application/json" \
  -d '{
    "url": "http://localhost:4000/unstable",
    "method": "GET",
    "maxRetries": 5,
    "backoffMs": 1000
  }'
```

**Response:** `{ "id": "<uuid>", "status": "pending" }`

### GET /requests/:id

Get the full request details including attempt history.

```bash
curl http://localhost:3000/requests/<id>
```

### GET /requests

List requests, optionally filtered by status.

```bash
curl http://localhost:3000/requests?status=failed
curl http://localhost:3000/requests?status=pending
curl http://localhost:3000/requests?status=completed
```

## Testing Guide

### Prerequisites

- Node.js 20+, pnpm 9+
- [Postman](https://www.postman.com/downloads/) (or any HTTP client)
- Terminal with two panes/split

### 1. Start the Retry Engine

```bash
pnpm dev
```

Server starts at `http://localhost:3000`.

### 2. Start the Mock Failure Server

Open a **second terminal** and run the included mock server (fails twice, then succeeds):

```bash
node src/mock-server.mjs
```

Mock server listens on `http://localhost:4000` — returns 500 twice per ID, then 200.

### 3. Run the Scenarios

#### Scenario A — 4xx Is NOT Retried

```bash
curl -X POST http://localhost:3000/request \
  -H "Content-Type: application/json" \
  -d '{"url": "https://httpbin.org/status/400", "method": "GET"}'
```

Then `GET /requests/<id>` — status jumps straight to `failed` with 1 attempt, no retries.

#### Scenario B — 5xx Retries and Eventually Succeeds

```bash
curl -X POST http://localhost:3000/request \
  -H "Content-Type: application/json" \
  -d '{"url": "http://localhost:4000/unstable?id=demo1", "method": "GET", "maxRetries": 5, "backoffMs": 1000}'
```

Poll `GET /requests/<id>` and watch attempts grow. Delays should roughly double:
| Attempt | Expected delay |
|---------|---------------|
| 1       | 1600–2400ms   |
| 2       | 3200–4800ms   |
| 3       | — succeeds    |

#### Scenario C — maxRetries Exhausted (Dead-Letter)

```bash
curl -X POST http://localhost:3000/request \
  -H "Content-Type: application/json" \
  -d '{"url": "https://httpbin.org/status/500", "method": "GET", "maxRetries": 2, "backoffMs": 500}'
```

Poll `GET /requests/<id>` — status becomes `failed` after 2 attempts, `"lastError": "HTTP 500"`.

### Server Logs Reference

```
[INFO] Request completed successfully     attemptNumber: 1
[INFO] Request failed                     reason: "non-retriable status" error: "HTTP 400"
[INFO] Request scheduled for retry        attemptNumber: 1 delay: 1650
[INFO] Request scheduled for retry        attemptNumber: 2 delay: 3200
[INFO] Request completed successfully     attemptNumber: 3
[INFO] Request failed                     reason: "max retries exhausted" error: "HTTP 500"
```

## Architecture

[PLACEHOLDER: Architecture diagram of the retry flow — API → storage → worker → external service]

```
┌──────────┐     ┌──────────┐     ┌──────────┐     ┌──────────┐
│  Client  │ ──▶ │   API    │ ──▶ │ Storage  │ ◀── │  Worker  │
│ (curl)   │     │(Express) │     │ (SQLite) │     │ (loop)   │
└──────────┘     └──────────┘     └──────────┘     └──────────┘
                                                       │
                                                       ▼
                                                ┌──────────┐
                                                │ External │
                                                │ Service  │
                                                └──────────┘
```

## Core Concepts

[PLACEHOLDER: Explain why exponential backoff and jitter matter, and why some errors (5xx, timeouts, network) should be retried while others (4xx) shouldn't.]

## Screenshot

[PLACEHOLDER: Screenshot of `GET /requests/:id` showing attempt history of a request that failed a few times and eventually succeeded.]

## What I Struggled With

[PLACEHOLDER: Bugs you hit, things that didn't work the first time, moments you were stuck.]

## What I Learned

[PLACEHOLDER: Concepts, patterns, language/framework features, or debugging techniques that were new to you.]

## Resources

[PLACEHOLDER: Articles, docs, Stack Overflow threads, AI prompts, videos — anything that helped. Link them.]

## Why This Made Me a Better Backend Developer

[PLACEHOLDER: Be specific. What can you do now that you couldn't before? Which production scenarios will you think about differently?]

## Demo Video

[PLACEHOLDER: Link to your 30-second demo video (YouTube unlisted, Google Drive, or Loom). Show: (1) request that fails a few times then succeeds with visible doubling backoff, (2) 4xx case not retried, (3) request that hits maxRetries and is dead-lettered.]

