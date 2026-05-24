> BACKFILLED ARTIFACT
> Reverse-engineered from `spine/src/routes/` on 2026-05-23.
> This is NOT the original intent of the feature; it is an inferred
> description based on code inspection. Treat as documentation, not spec.

# Plan: Spine REST API

## 1. Architecture As-Is

```
spine/src/index.ts       - entry point: initDb, initSearch, buildApp, listen :3000
spine/src/app.ts         - Elysia app: mounts all route plugins, auth guards, static serving
spine/src/db.ts          - initDb(), runMigrations(), getDb()
spine/src/search.ts      - initSearch(), search(), searchDeep(), writeCaptureFile()...
spine/src/guards.ts      - Authentik OIDC bearer check + DEV_USER bypass
spine/src/commands.ts    - parseCommand() for triage shortcut syntax
spine/src/captureEvents.ts - SSE emitter for capture stream
spine/src/working.ts     - working doc file I/O helpers

routes/
  agent.ts       - POST /api/agent/capture, /api/agent/file (agent-token auth)
  attachments.ts - GET/POST/DELETE /api/captures/:id/attachments
  captures.ts    - GET/POST/PATCH/DELETE /api/captures + SSE stream
  files.ts       - GET /api/files, /api/files/:id
  lateral.ts     - GET /api/similar (mentions / similar / nearby)
  search.ts      - GET /api/search?q=&deep=
  status.ts      - GET /api/status
  tasks.ts       - GET/PATCH /api/tasks, /api/tasks/done, /api/tasks/:id
  working.ts     - GET/POST/PATCH/DELETE /api/working/:slug + working attachments
```

## 2. Data Model

SQLite, 9 migrations:
- `captures` (id, text, source, captured_at, ingested_at, triaged_at, triage_action,
  task_due_date, task_priority, task_notes, task_completed_at)
- `file_index` (id, machine_id, path, mime_type, text, hash, modified_at, size_bytes)
- `capture_attachments` (id, capture_id, filename, content_type, size_bytes, stored_path,
  upload_source, created_at)
- `agent_status` (machine_id, state, last_scan_at, last_indexed, last_skipped, last_errors,
  spine_ok, last_error_msg, reported_at)
- `working_attachments` (id, slug, filename, content_type, size_bytes, stored_path, created_at)
- `schema_migrations` (name, applied_at)

## 3. API Contracts

| Method | Path | Auth | Description |
|--------|------|------|-------------|
| GET | /api/captures | user | list inbox captures (untriaged by default) |
| POST | /api/captures | user | create capture manually |
| PATCH | /api/captures/:id | user | triage, edit, attach |
| DELETE | /api/captures/:id | user | delete capture |
| GET | /api/captures/stream | user | SSE stream of new captures |
| GET | /api/captures/:id/attachments | user | list attachments |
| POST | /api/captures/:id/attachments | user | upload attachment |
| GET | /api/files | user | list indexed local files |
| GET | /api/files/:id | user | get file details |
| GET | /api/search | user | full-text + vector search |
| GET | /api/similar | user | lateral search (mentions/similar/nearby) |
| GET | /api/tasks | user | active tasks |
| GET | /api/tasks/done | user | completed tasks |
| PATCH | /api/tasks/:id | user | update task fields |
| GET | /api/working | user | list working docs |
| POST | /api/working | user | create working doc |
| GET | /api/working/:slug | user | get working doc |
| PATCH | /api/working/:slug | user | update (ETag conflict detection) |
| DELETE | /api/working/:slug | user | delete working doc |
| GET | /api/status | user | agent heartbeat status |
| POST | /api/agent/capture | agent-token | ingest capture from agent |
| POST | /api/agent/file | agent-token | ingest file index entry |
| POST | /api/agent/status | agent-token | push agent status heartbeat |

## 4. Dependencies

- `bun:sqlite` for database
- `elysia` + Bun HTTP for routing
- Search index (BM25 + optional vector) — see `spine/src/search.ts`
- `qmd` (quantum-meta-document) for search indexing — NEEDS-CLARIFICATION
- Authentik OIDC for user auth

## 5. Known Technical Debt

- `DEV_USER` env fully bypasses auth — must never be set in production; only a warn log guards it.
- No cursor pagination — all list endpoints use `LIMIT` only; large inboxes will truncate.
- `triage_action` values are string literals checked at runtime (`VALID_TRIAGE_ACTIONS` Set)
  rather than a DB-level enum or TypeScript union enforced at the type layer.
- Working doc attachments and capture attachments share the same `attachmentsDir` base but are
  distinguished by subpath; a stale symlink could bypass the path traversal check.
