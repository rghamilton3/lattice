# Tasks: Cursor Pagination for Spine Lists

**Input**: `features/spine-api/plan.md`
**Spec**: `features/spine-api/spec.md`
**Product context**: `features/spine-api/product-spec/README.md` identifies pagination cursors as the open API gap this feature closes.

## Phase 1: Captures Pagination (US1, FR-001, FR-003, FR-004, FR-005, FR-006, FR-007, FR-008)

**Goal**: `/api/captures` returns stable cursor-paginated pages without skipping or duplicating rows, including `all=1` behavior.

**Independent test**: Seed captures, request `limit=2`, follow `next_cursor`, and verify ordered non-overlapping ids plus `next_cursor: null` on the final page.

- [x] T001 [US1] Add captures route tests for first page, next page, final page, `all=1`, limit cap, and invalid cursor
      Paths: spine:tests/routes/captures.test.ts
      Size: M

- [x] T002 [US1] Implement capture cursor encode/decode and invalid cursor handling
      Paths: spine:src/routes/captures.ts
      Size: S

- [x] T003 [US1] Replace captures limit-only query with keyset pagination ordered by `ingested_at DESC, id DESC`
      Paths: spine:src/routes/captures.ts
      Size: M

- [x] T004 [US1] Return captures list responses as `{ items, next_cursor }` while preserving filters, auth, and limit cap behavior
      Paths: spine:src/routes/captures.ts
      Size: M

## Phase 2: Files Pagination (US2, FR-002, FR-003, FR-004, FR-005, FR-006, FR-007, FR-008)

**Goal**: `/api/files` returns stable cursor-paginated pages for indexed files without exposing file paths or hashes inside cursors.

**Independent test**: Seed files, request `limit=2`, follow `next_cursor`, and verify ordered non-overlapping ids plus `next_cursor: null` on the final page.

- [x] T005 [P] [US2] Add files route tests for first page, next page, final page, limit cap, and invalid cursor
      Paths: spine:tests/routes/files.test.ts
      Size: M

- [x] T006 [US2] Implement file cursor encode/decode and invalid cursor handling
      Paths: spine:src/routes/files.ts
      Size: S

- [x] T007 [US2] Replace files limit-only query with keyset pagination ordered by `modified_at DESC, id DESC`
      Paths: spine:src/routes/files.ts
      Size: M

- [x] T008 [US2] Return files list responses as `{ items, next_cursor }` while preserving auth and limit cap behavior
      Paths: spine:src/routes/files.ts
      Size: M

## Phase 3: Surface Compatibility (US3, FR-009, NFR-003)

**Goal**: In-repo surface list clients compile and continue to provide the current first-page behavior for existing UI consumers.

**Independent test**: Existing surface callers can call capture and file list helpers without passing a cursor and receive first-page items from the new response shape.

- [x] T009 [P] [US3] Update captures API client types and response normalization for `{ items, next_cursor }`
      Paths: surface:src/lib/api/captures.ts
      Size: S

- [x] T010 [P] [US3] Update files API client types and response normalization for `{ items, next_cursor }`
      Paths: surface:src/lib/api/files.ts
      Size: S

## Phase 4: Verification and Cross-Cutting Checks (SC-001, SC-002, SC-003, NFR-001, NFR-002)

**Goal**: Confirm the feature satisfies route coverage, privacy, performance, and compile/test expectations without adding dependencies or schema changes.

- [x] T011 Verify cursor tokens encode only kind, version, timestamp, and id; no capture text, file path, hash, or user content
      Paths: spine:src/routes/captures.ts, spine:src/routes/files.ts
      Size: XS

- [x] T012 Run spine route tests and fix regressions from response-shape changes
      Paths: spine:tests/routes/captures.test.ts, spine:tests/routes/files.test.ts, spine:src/routes/captures.ts, spine:src/routes/files.ts
      Size: M

- [x] T013 Run project checks and resolve type/build failures in spine or surface API clients
      Paths: spine:src/routes/captures.ts, spine:src/routes/files.ts, surface:src/lib/api/captures.ts, surface:src/lib/api/files.ts
      Size: M

## Dependencies

- Complete T001 before T002-T004; those tasks deliver US1 independently.
- Complete T005 before T006-T008; those tasks deliver US2 independently and can proceed in parallel with the captures phase after shared response expectations are understood.
- Complete T009-T010 after the corresponding backend response shape is implemented; these tasks preserve US3 compatibility.
- Complete T011-T013 after implementation tasks to verify privacy, test coverage, and project checks.

## Parallel Opportunities

- T005 can run in parallel with T001 because files and captures tests touch separate route suites.
- T009 and T010 can run in parallel after backend response contracts are stable because they touch separate surface API client files.
- T011 can run independently as a focused review once T002-T008 are complete.

## Implementation Strategy

- MVP first: complete T001-T004 for `/api/captures`, then run the captures route tests.
- Incremental delivery: complete T005-T008 for `/api/files`, then update surface clients with T009-T010.
- Finalize with T011-T013 and keep commits grouped by captures backend, files backend, surface compatibility, and verification fixes.
