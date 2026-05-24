# Feature Specification: Cursor Pagination for Spine Lists

**Feature Branch**: `spine-api-cursor-pagination`
**Created**: 2026-05-24
**Status**: Draft
**Input**: Add cursor pagination to `/api/captures` and `/api/files`

## User Scenarios & Testing

### User Story 1 - Browse captures beyond the first page (Priority: P1)

As a user with more captures than the default list limit, I can request the next page of `/api/captures` using a cursor returned by the previous response so the inbox and library can continue loading older captures without skipping or duplicating records.

**Independent Test**: Seed captures with distinct `ingested_at` values, request `limit=2`, then request the returned `next_cursor`; assert the combined ids are ordered newest-to-oldest with no duplicates.

**Acceptance Criteria**:

1. **Given** more untriaged captures than the requested limit, **When** `GET /api/captures?limit=2` is called, **Then** the response includes two capture rows and a non-null `next_cursor`.
2. **Given** a `next_cursor` from the first page, **When** `GET /api/captures?limit=2&cursor=<cursor>` is called, **Then** the response starts after the last row from the prior page.
3. **Given** `all=1`, **When** paginating captures, **Then** the cursor applies to the all-captures ordering while preserving inclusion of triaged rows.

### User Story 2 - Browse indexed files beyond the first page (Priority: P1)

As a user with more indexed files than the default list limit, I can request the next page of `/api/files` using a cursor returned by the previous response so the file library can load older files predictably.

**Independent Test**: Seed files with distinct `modified_at` values, request `limit=2`, then request the returned `next_cursor`; assert the combined ids are ordered newest-to-oldest with no duplicates.

**Acceptance Criteria**:

1. **Given** more files than the requested limit, **When** `GET /api/files?limit=2` is called, **Then** the response includes two file rows and a non-null `next_cursor`.
2. **Given** a `next_cursor` from the first page, **When** `GET /api/files?limit=2&cursor=<cursor>` is called, **Then** the response starts after the last row from the prior page.

### User Story 3 - Preserve existing list consumers (Priority: P2)

As the existing surface UI, I can continue using `/api/captures?limit=N` and `/api/files?limit=N` without passing a cursor and receive the current first-page behavior.

**Independent Test**: Existing route tests for limit/default behavior continue passing after response shapes are updated and callers are adjusted.

## Requirements

### Functional Requirements

- **FR-001**: `GET /api/captures` MUST accept an optional `cursor` query parameter in addition to `limit` and `all`.
- **FR-002**: `GET /api/files` MUST accept an optional `cursor` query parameter in addition to `limit`.
- **FR-003**: Both endpoints MUST return an object with `items` and `next_cursor` fields for list responses.
- **FR-004**: `next_cursor` MUST be `null` when no additional rows exist.
- **FR-005**: Pagination ordering MUST be stable when timestamp values collide by using the primary key as a deterministic tie-breaker.
- **FR-006**: Invalid or malformed cursors MUST return `400` with a clear error response instead of silently falling back to the first page.
- **FR-007**: Existing maximum limits MUST remain unchanged: captures capped at `200`, files capped at `500`.
- **FR-008**: Cursor encoding MUST be opaque to API consumers and derived only from existing ordering fields; no database schema migration is required.
- **FR-009**: The surface API clients MUST be updated for the new response shape where they consume list endpoints.

### Non-Functional Requirements

- **NFR-001 Performance**: Page queries MUST use keyset pagination predicates and continue to avoid offset scans.
- **NFR-002 Security/Privacy**: Cursors MUST NOT expose user text, file paths, or sensitive content.
- **NFR-003 Compatibility**: First-page calls without `cursor` MUST preserve ordering, auth model, and limit behavior.

## Entities

- **Capture Page Cursor**: Opaque token containing the last row's `ingested_at` and `id`, matching `ORDER BY ingested_at DESC, id DESC`.
- **File Page Cursor**: Opaque token containing the last row's `modified_at` and `id`, matching `ORDER BY modified_at DESC, id DESC`.
- **Paginated Response**: JSON object `{ items: T[], next_cursor: string | null }`.

## Assumptions

- Cursor pagination is planned now for `/api/captures` and `/api/files`, resolving the open question in the backfilled product spec.
- No external API consumers require the old raw-array response shape beyond the in-repo surface client and tests.
- SQLite schema already has the ordering fields needed for keyset pagination.

## Success Criteria

- **SC-001**: Route tests cover first page, next page, final page, invalid cursor, limit cap, and capture `all=1` behavior.
- **SC-002**: `bun test` in `spine` passes.
- **SC-003**: Surface list clients compile against the new response object shape.
