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
bun run dev       # dev server with hot reload; needs env vars below
bun run start     # run without watch
bun run relay     # run the Signal -> spine relay process
bun test          # run all tests
bun test src/foo.test.ts  # run a single test file
bun run lint      # oxlint src/
bun run format    # prettier --write .
```

From the monorepo root (preferred for full-stack dev):

```bash
just dev          # run spine + surface dev servers together
just test         # run spine tests
just lint         # clippy + oxlint + eslint across all components
just fmt          # format all components
just check        # tsc --noEmit for all TypeScript components
```

## Environment variables

| Variable              | Default               | Notes                                                                    |
| --------------------- | --------------------- | ------------------------------------------------------------------------ |
| `LATTICE_AGENT_TOKEN` | read from config.toml | Required for agent routes; unset means all agent routes reject with 401  |
| `DEV_USER`            | unset                 | Set to any string to bypass Authentik auth. **Never set in production.** |
| `ALLOW_HTTP`          | unset                 | Set to `true` to allow non-TLS connections (required in dev)             |
| `DATABASE_PATH`       | `./lattice.dev.db`    | Override main SQLite path                                                |
| `SURFACE_BUILD`       | `../../surface/build` | Path to built surface static files                                       |

Config file alternative to env vars: `~/.config/lattice/config.toml`

```toml
[spine]
agent_token = "..."
database_path = "/var/lib/lattice/lattice.db"
```

## Databases

Spine uses two SQLite files side-by-side:

- `lattice.dev.db` (or `DATABASE_PATH`) - all structured data; migrations from `migrations/` applied on startup
- `lattice.qmd.db` - QMD vector embeddings; managed entirely by `@tobilu/qmd`, never hand-migrated

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

### Route structure

**No auth:**

- `GET /ping` - health check

**Bearer-token auth (`/api/agent/*`):**

- `POST /api/agent/capture` - ingest a capture `{ text, source, captured_at }`
- `POST /api/agent/index` - upsert file index entries; idempotent on `(machine_id, path, hash)`
- `GET /api/agent/status` - agent heartbeat / status report

**Authentik auth (all other `/api/*`):**

- `GET /api/captures` - recent captures
- `GET /api/captures/stream` - SSE stream of new captures
- `GET /api/tasks` - active tasks
- `GET /api/tasks/done` - completed tasks
- `PATCH /api/tasks/:id/triage` - triage a capture into a task
- `PATCH /api/tasks/:id/complete` - mark task complete
- `GET /api/search?q=` - vector search via QMD
- `GET /api/lateral/:id` - related items for a capture or file
- `GET /api/working` - list working docs
- `POST /api/working` - create working doc
- `GET|PUT|DELETE /api/working/:slug` - read/update/delete a working doc
- `GET|POST /api/working/:slug/attachments` - list or upload attachments
- `GET|DELETE /api/working/:slug/attachments/:id` - read or delete attachment
- `GET /api/files` - local file index
- `GET /api/status` - spine system status

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
