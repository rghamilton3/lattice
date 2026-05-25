# Plan — Digest

> **Feature:** spine-api
> **Phase:** plan
> **Generated at:** 2026-05-24T15:14:18Z
> **Artifact owner:** speckit.product-forge.plan

## Key decisions

- Add keyset cursor pagination to `GET /api/captures` and `GET /api/files` using existing SQLite ordering columns.
- Use opaque base64url JSON cursors with version, kind, timestamp, and id; do not encode capture text, file paths, hashes, or user content.
- Return list responses as `{ items, next_cursor }` and update in-repo surface API wrappers instead of adding a spine backward-compatibility shim.
- Keep cursor parsing local to `captures.ts` and `files.ts` unless a third concrete callsite justifies extraction.
- Avoid schema migrations and new dependencies; optional indexes are a follow-up only if query plans show they are needed.

## Artifacts produced

- `features/spine-api/spec.md` — Targeted specification for cursor pagination on captures and files list endpoints.
- `features/spine-api/plan.md` — Technical plan covering API contracts, route integration, surface wrapper updates, testing strategy, risks, and constitution compliance.

## Open risks

- Mitigated: Timestamp ties can skip or duplicate rows unless pagination always orders by timestamp plus `id` tie-breaker.
- Accepted: Response shape changes from raw arrays to `{ items, next_cursor }`, requiring surface wrapper and test updates in the same implementation.
- Accepted: Endpoint-specific rate limiting remains out of scope because this feature adds no new route group, external call, or write amplification.

## Handoff notes for next phase

- Task generation must include route tests before implementation for first page, next page, final page, malformed cursor, limit cap, and captures `all=1` behavior.
- Implementation should touch `spine/src/routes/captures.ts`, `spine/src/routes/files.ts`, `spine/tests/routes/captures.test.ts`, `spine/tests/routes/files.test.ts`, `surface/src/lib/api/captures.ts`, and `surface/src/lib/api/files.ts`.
- Use `limit + 1` SQL reads to compute `next_cursor`, then return only `limit` items.
- Verify with `just test` and `just check`; use `bun test` from `spine/` as a component-level fallback.
