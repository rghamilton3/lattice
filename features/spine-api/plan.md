# Implementation Plan: Cursor Pagination for Spine Lists

**Branch**: `spine-api-cursor-pagination` | **Date**: 2026-05-24 | **Spec**: `features/spine-api/spec.md`

**Input**: Product Forge Phase 5 plan for adding cursor pagination to `/api/captures` and `/api/files`.

## Summary

Add keyset cursor pagination to the two list endpoints that currently use limit-only queries:
`GET /api/captures` and `GET /api/files`. Responses will change from raw arrays to `{ items, next_cursor }`, with cursors encoded as opaque base64url JSON tokens containing only the stable ordering keys. No schema migration or new dependency is required.

## Technical Context

**Language/Version**: TypeScript on Bun

**Primary Dependencies**: Elysia, `bun:sqlite`

**Storage**: SQLite tables `captures` and `file_index`; no migration required

**Testing**: `bun test` route tests under `spine/tests/routes/`

**Target Platform**: Self-hosted Linux server, spine bound to localhost behind Caddy + Authentik

**Project Type**: Monorepo web service with SvelteKit surface client

**Performance Goals**: Page through large capture/file lists without offset scans; preserve existing first-page latency

**Constraints**: No new runtime dependencies; no ORM; direct `bun:sqlite`; preserve current auth model and limit caps

**Scale/Scope**: Two spine route modules, two surface API clients, route tests for both endpoints

## Plan Brief

SpecKit spec: `features/spine-api/spec.md`

Product spec: `features/spine-api/product-spec/README.md` (backfilled product spec; `product-spec.md` is absent)

Codebase path: `spine`

Must Have stories to plan: 2 primary stories, plus 1 compatibility story

Integration points: 6

Key tech constraints:

- Keep SQLite via `bun:sqlite`; do not introduce ORM or migration unless necessary.
- Spine owns REST API and persistence; surface communicates only through `/api/*`.
- Auth model remains unchanged: Authentik-forwarded user auth for both list endpoints.

## Constitution Check

| Principle | Gate Question | Pass / Violation |
|-----------|--------------|------------------|
| I. Self-Hosting First | Does this feature add a mandatory external service? | Pass |
| II. Component Boundaries | Does this feature introduce cross-component coupling beyond REST API contracts? | Pass |
| III. Local-First Data | Does this feature store user data outside SQLite/local files? | Pass |
| IV. Security by Design | Does this feature add a new route group without a declared auth model? | Pass |
| V. Simplicity | Does this feature introduce an abstraction with fewer than 3 concrete callsites? | Pass |
| V. Simplicity | Does this feature introduce an ORM, feature flag, or backwards-compat shim? | Pass |
| Tech Stack | Does this feature add a runtime dependency outside the approved stack? | Pass |

## Project Structure

```text
features/spine-api/
├── spec.md
├── plan.md
└── plan/digest.md

spine/
├── src/routes/captures.ts
├── src/routes/files.ts
└── tests/routes/
    ├── captures.test.ts
    └── files.test.ts

surface/src/lib/api/
├── captures.ts
└── files.ts
```

**Structure Decision**: Keep cursor parsing and response shaping inside the two route modules unless a third callsite appears. This matches the constitution's simplicity rule and avoids premature shared abstractions.

## Data Model

No database schema change.

### Cursor Shapes

Capture cursor payload:

```json
{ "v": 1, "kind": "captures", "ingested_at": "2026-01-01T00:00:00.000Z", "id": 123 }
```

File cursor payload:

```json
{ "v": 1, "kind": "files", "modified_at": "2026-01-01T00:00:00.000Z", "id": 456 }
```

Cursors are base64url-encoded JSON. They include only ordering fields and ids; they do not include capture text, file paths, hashes, or user content.

## API Contracts

### `GET /api/captures`

Query parameters:

- `limit?: string` - defaults to `50`, capped at `200`
- `all?: string` - existing `all=1` behavior includes triaged captures
- `cursor?: string` - optional opaque cursor from prior page

Response:

```json
{
  "items": [
    {
      "id": 123,
      "text": "capture text",
      "source": "browser",
      "captured_at": "2026-01-01T00:00:00.000Z",
      "ingested_at": "2026-01-01T00:00:00.000Z",
      "triaged_at": null,
      "triage_action": null,
      "first_image_id": null
    }
  ],
  "next_cursor": "opaque-token-or-null"
}
```

Ordering and cursor predicate:

```sql
ORDER BY ingested_at DESC, id DESC
WHERE (ingested_at < ? OR (ingested_at = ? AND id < ?))
```

The route should query `limit + 1` rows to determine `next_cursor`, then return only `limit` items.

### `GET /api/files`

Query parameters:

- `limit?: string` - defaults to `100`, capped at `500`
- `cursor?: string` - optional opaque cursor from prior page

Response:

```json
{
  "items": [
    {
      "id": 456,
      "machine_id": "host",
      "path": "/home/user/doc.md",
      "mime_type": "text/markdown",
      "modified_at": "2026-01-01T00:00:00.000Z"
    }
  ],
  "next_cursor": "opaque-token-or-null"
}
```

Ordering and cursor predicate:

```sql
ORDER BY modified_at DESC, id DESC
WHERE (modified_at < ? OR (modified_at = ? AND id < ?))
```

The route should query `limit + 1` rows to determine `next_cursor`, then return only `limit` items.

### Error Contract

Malformed cursor or wrong cursor kind returns HTTP `400`:

```json
{ "error": "Invalid cursor" }
```

## Backend Services

- `spine/src/routes/captures.ts`: parse optional cursor, add keyset predicate, return paginated response object.
- `spine/src/routes/files.ts`: parse optional cursor, add keyset predicate, return paginated response object.

No new service module is planned unless implementation shows enough shared code to justify extraction.

## Frontend Components

No UI component changes are required for the first implementation step.

Surface API wrappers must update their return types/normalization:

- `surface/src/lib/api/captures.ts`
- `surface/src/lib/api/files.ts`

If existing components expect raw arrays, wrappers may return `items` to preserve internal component behavior only if no cursor-aware UI is implemented in this change. Do not add an API backward-compat shim in spine.

## Migrations / Schema Changes

None.

Optional follow-up only if query plans require it after measurement:

- `captures(ingested_at DESC, id DESC)`
- `file_index(modified_at DESC, id DESC)`

Do not add indexes speculatively before validating SQLite's existing behavior on expected data volumes.

## Testing Strategy

Coverage target: route-level tests for all new pagination branches in `captures.test.ts` and `files.test.ts`, plus existing route suites must continue passing.

Critical path tests:

- Captures first page returns `{ items, next_cursor }` and respects `limit` cap.
- Captures second page with cursor returns the next ordered rows with no duplicates.
- Captures final page returns `next_cursor: null`.
- Captures pagination preserves default untriaged filter and `all=1` mode.
- Captures malformed cursor returns `400`.
- Files first page returns `{ items, next_cursor }` and respects `limit` cap.
- Files second page with cursor returns the next ordered rows with no duplicates.
- Files final page returns `next_cursor: null`.
- Files malformed cursor returns `400`.

Integration test strategy: use the existing Elysia test app and in-memory/temp SQLite database helpers under `spine/tests/helpers/app.ts`; do not mock route SQL.

Verification commands:

```bash
just test
just check
```

Component-level fallback:

```bash
bun test
```

from `spine/`.

## Resilience & External Services

No external service calls are introduced. Both endpoints are local SQLite reads behind existing Authentik-forwarded user auth.

Public-facing endpoint considerations:

- Existing Caddy/Auth middleware remains unchanged.
- Endpoint-specific rate limiting is not introduced in this change; this is acceptable because the feature does not add new public route groups or write amplification.
- No external timeout configuration is applicable.

## Data & Privacy

The feature stores no new user data and adds no data retention behavior. Cursor tokens expose only timestamps and numeric ids needed for ordering. File paths, capture text, hashes, and attachment metadata must not be encoded into cursors.

## Implementation Sequencing

1. Add route tests for captures cursor behavior and update existing list response assertions.
2. Implement captures cursor parsing, keyset SQL, and paginated response.
3. Add route tests for files cursor behavior and update existing list response assertions.
4. Implement files cursor parsing, keyset SQL, and paginated response.
5. Update surface API wrappers and any tests/types that assumed raw arrays.
6. Run spine tests and TypeScript checks.

## Risks & Mitigations

| Risk | Impact | Mitigation |
|------|--------|------------|
| Response shape change breaks surface callers | UI runtime failures | Update `surface/src/lib/api/*` wrappers in the same change and run checks |
| Timestamp ties cause skipped/duplicated rows | Incorrect pagination | Always order and cursor by timestamp plus `id` tie-breaker |
| Cursor exposes private file path/text | Privacy leak | Encode only timestamp, id, version, and kind |
| Existing tests expect raw arrays | Test failures | Update tests to assert `items` and `next_cursor` explicitly |

## Complexity Tracking

No constitution violations. No new dependencies, abstractions, external services, migrations, feature flags, or compatibility shims are planned.
