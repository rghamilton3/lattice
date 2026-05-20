# spine — core

Central API server for the Lattice PKM system. TypeScript/Bun, Elysia framework, SQLite (no ORM).

## Source map

- `src/index.ts` — entrypoint; creates Elysia app, registers routes, listens on port 3000
- `migrations/` — numbered SQL files (e.g. `001_captures.sql`); applied in order at startup; canonical schema definition
- `package.json` — bun project; single dep: `elysia`; devDep: `bun-types`
- `tsconfig.json` — ES2021 target, strict mode, bun-types, moduleResolution: node
- `mise.toml` — pins `bun = "latest"` via mise

## Planned route structure

- `GET /ping` — health check, no auth
- `POST /api/agent/capture` — bearer auth; `{ text, source, captured_at }` → `{ id }`; TypeBox validation
- `GET /api/captures?limit=N` — Authelia auth; returns recent captures
- `POST /api/agent/index` — bearer auth; upserts local file index; idempotent on `(machine_id, path, hash)`
- `GET /api/search?q=<query>` — Authelia auth; delegates to QMD vector search

## Auth model

- `/api/agent/*` → Bearer token checked against `LATTICE_AGENT_TOKEN` env var
- All other routes → Authelia forward-auth; trust `Remote-User` header from Caddy; reject if missing
- Must fail closed on non-HTTPS (Caddy handles TLS; defense-in-depth)

## DB invariants

- SQLite via `bun:sqlite`; no ORM
- DB path on VPS: `/var/lib/lattice/lattice.db`
- Never alter tables by hand; all schema changes via numbered migration files
- Upserts on `(machine_id, path, hash)` must be no-ops for re-sent indexer payloads

## System context

Spine is one sibling under `lattice/`:
- `spine/` — this repo
- `agent/` — Rust local file indexer; POSTs `{ machine_id, path, hash, mime_type, text, modified_at, size_bytes }` to `/api/agent/index`
- `surface/` — SvelteKit SPA; built to static files, served by spine from `/`

Spine binds to localhost only. Caddy is the sole external-facing process.
Spine owns all embedding — no local index on the agent side.

See `mem:tech_stack` for versions, `mem:conventions` for code style, `mem:suggested_commands` for dev/test commands.
