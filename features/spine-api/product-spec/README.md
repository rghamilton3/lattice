> BACKFILLED ARTIFACT
> Reverse-engineered from `spine/src/routes/` on 2026-05-23.
> This is NOT the original intent of the feature; it is an inferred
> description based on code inspection. Treat as documentation, not spec.

# Spine REST API

## 1. Feature Summary

The spine REST API is the central data layer of Lattice. It is an Elysia (Bun) HTTP server that
exposes endpoints for capturing and triaging text/attachments, indexing local files, full-text and
semantic search, task management, working document CRUD, lateral/similar search, and agent status
reporting. The API serves authenticated agent clients (file indexer, signal relay) and the surface
SPA equally.

## 2. Target Users

- The Lattice surface SPA (browser) for all read/write operations on captured and working content.
- The Rust agent daemon for file index ingestion and status heartbeats.
- The signal relay process for posting captures from Signal.
- Developer tools / direct curl for manual capture injection.

## 3. Primary User Stories

- As a user, I can view, triage, and act on captures in the inbox.
- As a user, I can search across captures, local files, and working docs with a single query.
- As a user, I can create and edit working documents seeded from captures or local files.
- As a user, I can manage tasks (create, prioritize, complete) that originated as triaged captures.
- As an agent, I can POST file index entries so they appear in search.
- As a user, I can see which agents are active and when they last scanned.

## 4. In-Scope / Out-of-Scope

**In scope (observed):**
- `GET/POST /api/captures`, `PATCH/DELETE /api/captures/:id`
- `GET /api/captures/stream` - SSE stream for live inbox updates with keep-alive heartbeat
- `GET/POST/PATCH/DELETE /api/working/:slug` - working document CRUD with ETag-based conflict detection
- `GET /api/working/:slug/attachments`, `POST /api/working/:slug/attachments/:filename`
- `GET /api/captures/:id/attachments`, `POST /api/captures/:id/attachments`
- `POST /api/agent/capture` + `POST /api/agent/file` - authenticated agent ingestion
- `GET /api/search?q=&deep=` - BM25 + vector search, optional deep LLM mode
- `GET /api/similar?kind=&id=` - lateral/similar document search
- `GET /api/tasks`, `GET /api/tasks/done`, `PATCH /api/tasks/:id`
- `GET /api/files`, `GET /api/files/:id`
- `GET /api/status` - agent heartbeat status
- Static file serving of `surface/build/` and `index.html` fallback for SPA routing

**Out-of-scope (not observed):**
- Multi-user auth — single user assumed (Authentik auth or DEV_USER bypass)
- Pagination cursors (only limit-based)
- Webhooks or push notifications to external systems

## 5. Non-Functional Reality

- **Auth**: Authentik OIDC via `guards.ts` for surface routes; `LATTICE_AGENT_TOKEN` bearer for
  agent routes. `DEV_USER` env bypasses all auth (development only).
- **DB**: SQLite with WAL mode, 9 migrations, Bun's `bun:sqlite` driver.
- **Search index**: Markdown files on disk fed to a search layer (BM25 + optional vector).
- **Atomicity**: Agent capture POST uses a DB transaction wrapping the SQL insert and markdown
  file write, so a filesystem error rolls back the DB row.
- **SSE**: Heartbeat ping every interval prevents Caddy idle timeout from dropping connections.
- **Path traversal prevention**: Attachment routes resolve canonical symlink paths and compare
  against the known base directory before serving.
- **ETag conflict detection**: Working doc updates check `If-Match` header.

## 6. Open Questions

- NEEDS-CLARIFICATION: Is pagination (cursor-based) planned for captures/files endpoints?
- NEEDS-CLARIFICATION: Are there rate limits on agent ingestion endpoints?
- NEEDS-CLARIFICATION: What is the intended retention policy for archived captures?
- NEEDS-CLARIFICATION: Does the `deep` search mode have cost/latency implications that should be
  surfaced to the user?
