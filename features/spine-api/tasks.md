> BACKFILLED ARTIFACT
> Reverse-engineered from `spine/src/routes/` on 2026-05-23.
> This is NOT the original intent of the feature; it is an inferred
> description based on code inspection. Treat as documentation, not spec.

# Tasks: Spine REST API

All tasks represent shipped components. All marked [x].

- [x] T001 — Database init, migrations, WAL mode — `spine/src/db.ts`, `spine/migrations/`
- [x] T002 — Search init + BM25 index + deep LLM search — `spine/src/search.ts`
- [x] T003 — Auth guards (Authentik OIDC + DEV_USER bypass) — `spine/src/guards.ts`
- [x] T004 — Capture SSE event emitter — `spine/src/captureEvents.ts`
- [x] T005 — Command parser for triage shortcuts — `spine/src/commands.ts`
- [x] T006 — Working doc file I/O helpers — `spine/src/working.ts`
- [x] T007 — App builder (route mounting, static serving) — `spine/src/app.ts`
- [x] T008 — Agent ingestion routes (capture + file + status) — `spine/src/routes/agent.ts`
- [x] T009 — Capture attachment routes (list + upload + delete) — `spine/src/routes/attachments.ts`
- [x] T010 — Captures CRUD + SSE stream route — `spine/src/routes/captures.ts`
- [x] T011 — File index routes — `spine/src/routes/files.ts`
- [x] T012 — Lateral/similar search route (mentions/similar/nearby) — `spine/src/routes/lateral.ts`
- [x] T013 — Search route (BM25 + deep toggle) — `spine/src/routes/search.ts`
- [x] T014 — Agent status route — `spine/src/routes/status.ts`
- [x] T015 — Tasks routes (active/done/PATCH) with priority sort — `spine/src/routes/tasks.ts`
- [x] T016 — Working doc routes + ETag conflict detection — `spine/src/routes/working.ts`
- [x] T017 — Route-level integration tests — `spine/tests/routes/`
- [x] T018 — Unit tests (db, commands, search, signal) — `spine/tests/unit/`
