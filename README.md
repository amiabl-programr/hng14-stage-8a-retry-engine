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

**Exponential backoff** increases the delay between retries exponentially (e.g., 1s → 2s → 4s), preventing rapid repeated failures from overwhelming the server. **Jitter** adds randomness to each delay, avoiding the *thundering herd* problem where many clients retry simultaneously at the same interval.

**Retriable errors** — 5xx (server errors), timeouts, and network failures — are transient and may succeed on retry since the fault lies with the server or network, not the request itself.

**Non-retriable errors** — 4xx like 400, 401, 404, 422 — are client errors and will always fail the same way regardless of retries, so retrying them wastes resources.

## Screenshot

Screenshot of `GET /requests/:id` showing attempt history of a request that failed a few times and eventually succeeded.

![Image](/public/req_id.png)

## What I Struggled With

**Bug — Worker running a single request 3 times.**

The worker ticked every 500ms, but `executeRequest` awaited the HTTP call (~1–2s) before updating the DB. The next tick re-fetched the row (still `pending`) and fired another `executeRequest`.

**Fix:** The executor now claims the row synchronously before the HTTP call — it sets `status = retrying`, increments `attemptCount`, and pushes `nextRetryAt` 30s into the future. This acts as a soft lock that `getDueRequests` respects (`nextRetryAt <= now` excludes it), so subsequent worker ticks skip it.

**Alternative considered:** Adding a `processing` status to the other 4 enums, but that adds an extra DB trip per request and may cause performance issues.

## What I Learned

The whole concept of a retry engine was new to me — I've seen it in apps but never dug into why such a feature exists. I also discovered httpbin.org, which is a really handy tool for testing HTTP interactions. Building a mock server that fails twice then succeeds on the third attempt taught me a clean testing pattern I wouldn't have thought of on my own. I was also introduced to **nock** for HTTP server mocking.

## Resources

- [Exponential Backoff and Jitter Article](https://theshubhendra.medium.com/exponential-backoff-with-jitter-because-everyone-cant-call-at-once-10f4ef238f1f)
- [httpbin.org](https://httpbin.org) — HTTP request & response testing service
- [nock](https://github.com/nock/nock) — HTTP server mocking for Node.js
- [Exponential Backoff and Jitter (AWS Architecture Blog)](https://aws.amazon.com/blogs/architecture/exponential-backoff-and-jitter/) — explains why jitter matters in distributed systems
- [Node.js Promises](https://nodejs.org/learn/asynchronous-work/discover-promises-in-nodejs#promise-based-nodejs-apis) — understanding asynchronous work


## Why This Made Me a Better Backend Developer

Now, I'll make sure to include a retry engine for external API calls like Google OAuth integration, MCP integration, and others. I can see this being useful when using Cloudinary for image upload/retrieval or video streaming.

## Demo Video

https://drive.google.com/file/d/1vFOZZYBpllU2gZDO5eKW61V2cXhamhLD/view?usp=drive_link

