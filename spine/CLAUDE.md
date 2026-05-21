# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## What spine is

Spine is the central server for Lattice — a personal knowledge management system. It is a TypeScript/Bun application
using the Elysia framework that:

- Owns the SQLite database (`/var/lib/lattice/lattice.db` on the VPS)
- Serves the REST API for both browser clients and the local indexer agent
- Serves the SvelteKit surface as static files from `/`
- Hosts QMD (the embedding/retrieval library) as a library dependency
- Is the single source of truth for all owned content: inbox captures, working docs, references, archive, and annotations

Spine binds to **localhost only**. Caddy is the only process that talks to it from outside.

## Commands

```bash
bun run dev       # dev server with hot reload (--watch)
bun run src/index.ts  # run directly
bun test          # run tests (bun's built-in test runner)
bun test src/foo.test.ts  # run a single test file
```

## Architecture

### Auth model

Two distinct auth paths, enforced by middleware:

- `/api/agent/*` routes — **Bearer token** auth. Token checked against `LATTICE_AGENT_TOKEN` env var. No Authentik involvement.
- All other routes — **Authentik forward auth**. Trust the `X-Authentik-Username` header injected by Caddy after Authentik
  approves the request. Reject if the header is missing.

Spine must fail closed on non-HTTPS requests (Caddy handles TLS, but defense in depth).

### Database and migrations

- SQLite via Bun's built-in `bun:sqlite`. No ORM.
- Migrations live in `spine/migrations/` as numbered SQL files (e.g. `001_captures.sql`). They are applied in order on startup.
- The migrations directory is the canonical schema definition — never alter tables by hand.

### Route structure (per plan)

- `GET /ping` — health check, no auth
- `POST /api/agent/capture` — bearer-token auth; accepts `{ text, source, captured_at }`; validates with TypeBox;
  returns `{ id }`
- `GET /api/captures?limit=N` — Authentik auth; returns recent captures
- `POST /api/agent/index` — bearer-token auth; upserts local file index entries; idempotent on `(machine_id, path, hash)`
- `GET /api/search?q=<query>` — Authentik auth; delegates to QMD vector search

### Idempotency

The indexer agent re-sends payloads on restart and polling overlaps. Upserts on `(machine_id, path, hash)` must treat
re-sends as no-ops. Design this in; retrofitting is painful.

### Larger system context

Spine is one of three sibling directories under `lattice/`:

- `spine/` — this directory (Bun/Elysia, TypeScript)
- `agent/` — local file indexer (Rust); polls watched directories, POSTs to `/api/agent/index`
- `surface/` — SvelteKit SPA; built to static files, served by spine from `/`

The Rust agent POSTs `{ machine_id, path, hash, mime_type, text, modified_at, size_bytes }`.
Spine does all embedding — no local index on the agent side.
