> BACKFILLED ARTIFACT
> Reverse-engineered from `spine/src/routes/` on 2026-05-23.

# Gaps Report: spine-api

## 1. Summary Verdict

**Low gap**

Route-level integration tests exist for every route file. Unit tests cover db, commands, search
helpers, and working doc logic. Auth guards are present. The main gaps are missing ADRs,
no tracking plan, no monitoring setup, and a few observed debt items (no cursor pagination,
DEV_USER bypass is only warn-guarded).

## 2. Missing Artifacts

| Artifact                                                                | Status                                                             |
| ----------------------------------------------------------------------- | ------------------------------------------------------------------ |
| `research/` - competitor / UX / metrics research                        | Missing                                                            |
| ADRs in `plan.md`                                                       | Missing - SQLite vs Postgres, ETag design, SSE heartbeat rationale |
| E2E tests (surface + spine together)                                    | Missing - only spine-level integration                             |
| Tracking plan entries (API error rates, search latency, capture volume) | Missing                                                            |
| Feature flag registry entries                                           | Missing                                                            |
| Release-readiness checklist (DB backup, monitoring, alerts)             | Missing                                                            |
| Cursor-based pagination for captures/files                              | Missing (observed gap)                                             |
| Rate limiting on agent ingestion endpoints                              | Missing (observed gap)                                             |

## 3. Inferred vs Observed

| Claim                                               | Source                                            | Confidence |
| --------------------------------------------------- | ------------------------------------------------- | ---------- |
| Single user per instance                            | Authentik guard + DEV_USER design                 | HIGH       |
| SQLite WAL mode for write concurrency               | `PRAGMA journal_mode = WAL`                       | HIGH       |
| Atomic capture ingest (tx wrapping DB + file write) | Transaction comment in agent.ts                   | HIGH       |
| ETag conflict detection on working docs             | `If-Match` check in working.ts                    | HIGH       |
| SSE keep-alive heartbeat to survive Caddy timeout   | Comment in captures.ts                            | HIGH       |
| Path traversal prevention via realpath comparison   | realpathSync logic in working.ts + attachments.ts | HIGH       |
| DEV_USER bypasses all auth                          | Code + warn log                                   | HIGH       |
| BM25 + optional vector (LLM) search modes           | searchRoutes deep toggle                          | MEDIUM     |
| Limit-only pagination (no cursors)                  | All list queries use LIMIT only                   | HIGH       |

## 4. Recommended Next Actions

1. ~**Add cursor pagination** to `/api/captures` and `/api/files` before inbox grows large.~
   ~command: `/speckit-product-forge-plan --feature=spine-api` (change request)~

2. **Run tracking plan** to define API-level observability.
   Command: `/speckit-product-forge-tracking-plan --feature=spine-api`

3. **Add ADRs** for SQLite + WAL choice, ETag approach, and DEV_USER policy.

4. **Run release-readiness** to establish DB backup and alert runbook.
   Command: `/speckit-product-forge-release-readiness --feature=spine-api`

5. **Consider rate limiting** on `/api/agent/capture` and `/api/agent/file` to prevent runaway
   indexer from saturating spine.
