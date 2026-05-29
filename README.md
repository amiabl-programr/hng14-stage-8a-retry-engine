# hng14-stage-8a-retry-engine

Retry Engine — an Express-based API for managing retry logic.

## Setup

```bash
pnpm install
```

## Development

```bash
pnpm dev       # Hot-reload dev server
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

## Test

```bash
pnpm test
```

## Project Structure

```
src/
├── app.ts          # Express app configuration
├── server.ts       # Entry point
├── common/         # Shared utilities and types
├── config/         # Configuration
├── routes/         # Route definitions
├── controller/     # Request handlers
└── service/        # Business logic
tests/              # Test files
```
