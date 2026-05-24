# Code Review: Cursor Pagination for Spine Lists

> Feature: spine-api | Date: 2026-05-24
> Files reviewed: 8 | Tasks covered: 13/13
> Status: APPROVED

## Review Scope

Task-scoped files reviewed:

- `spine/src/routes/captures.ts`
- `spine/src/routes/files.ts`
- `spine/tests/routes/captures.test.ts`
- `spine/tests/routes/files.test.ts`
- `surface/src/lib/api/captures.ts`
- `surface/src/lib/api/files.ts`

Additional implementation-log files reviewed:

- `spine/tests/routes/agent.test.ts`
- `spine/tsconfig.json`

Approximate reviewed LOC: 1,747

## Summary

| Dimension | CRITICAL | HIGH | MEDIUM | LOW | Total |
|-----------|:--------:|:----:|:------:|:---:|:-----:|
| Quality | 0 | 0 | 0 | 0 | 0 |
| Security | 0 | 0 | 0 | 0 | 0 |
| Patterns | 0 | 0 | 0 | 0 | 0 |
| Tests | 0 | 0 | 0 | 0 | 0 |
| **Total** | **0** | **0** | **0** | **0** | **0** |

**Recommendation:** PROCEED TO VERIFY. All review recommendations have been implemented.

**Resolution update:** REV-001, REV-002, and REV-003 were fixed on 2026-05-24. The affected route tests pass with direct cap assertions for 200 captures and 500 files.

## Positive Highlights

- Cursor pagination uses keyset predicates with timestamp plus `id` tie-breakers, matching FR-005 and NFR-001 without introducing offset scans.
- Cursor payloads are limited to `v`, `kind`, ordering timestamp, and `id`, preserving the NFR-002 privacy requirement to avoid text, file paths, and hashes.
- Surface wrappers expose cursor-aware page helpers while preserving existing first-page array behavior through `fetchCaptures()` and `fetchFileList()`.

## Findings

### Tests

### REV-001: Capture limit-cap test does not prove the 200-row cap

| Field | Value |
|-------|-------|
| **Dimension** | Tests |
| **Severity** | MEDIUM |
| **File** | `spine/tests/routes/captures.test.ts:51-62` |
| **Rule** | SC-001 / FR-007: limit cap behavior must be covered by route tests |

**What:** The test sends `limit=500`, but only five captures are seeded. A regression that removes or changes the 200 cap would still return five rows and pass.

**Status:** Fixed. The test now seeds 205 captures and asserts the capped response contains 200 items.

**Why it matters:** FR-007 requires the captures cap to remain `200`. The current test verifies the route succeeds with an excessive limit, but not that the cap is actually enforced.

**Suggested fix:**

```ts
// Before
const big = await app.app.handle(req('/api/captures?limit=500'));
// We only seeded 5 - so "cap" can't be observed directly without inserting
// 200+ rows. But the query should still return successfully.
expect(big.status).toBe(200);
expect((await json(big)).items.length).toBe(5);

// After
for (let i = 5; i < 205; i++) seedCapture(app, `c${i}`);
const big = await app.app.handle(req('/api/captures?limit=500'));
expect(big.status).toBe(200);
expect((await json(big)).items.length).toBe(200);
```

### REV-002: File limit-cap test does not prove the 500-row cap

| Field | Value |
|-------|-------|
| **Dimension** | Tests |
| **Severity** | MEDIUM |
| **File** | `spine/tests/routes/files.test.ts:80-88` |
| **Rule** | SC-001 / FR-007: limit cap behavior must be covered by route tests |

**What:** The test sends `limit=900`, but only five files are seeded. A regression that removes or changes the 500 cap would still return five rows and pass.

**Status:** Fixed. The test now seeds 505 files and asserts the capped response contains 500 items.

**Why it matters:** FR-007 requires the files cap to remain `500`. The current test does not fail if the implementation allows responses larger than the documented maximum.

**Suggested fix:**

```ts
// Before
const big = await app.app.handle(req('/api/files?limit=900'));
expect(big.status).toBe(200);
expect((await json(big)).items.length).toBe(5);

// After
for (let i = 5; i < 505; i++) seedFile(app, `/data/${i}.txt`, `${i}`, 'm1', `h${i}`);
const big = await app.app.handle(req('/api/files?limit=900'));
expect(big.status).toBe(200);
expect((await json(big)).items.length).toBe(500);
```

### Patterns

### REV-003: Compiler deprecation suppression is outside the planned feature scope

| Field | Value |
|-------|-------|
| **Dimension** | Patterns |
| **Severity** | LOW |
| **File** | `spine/tsconfig.json:103-104` |
| **Rule** | Feature scope discipline: cross-cutting config changes should be explicitly justified or separated |

**What:** `ignoreDeprecations: "6.0"` was added to `spine/tsconfig.json`, but this file is not part of the task-scoped implementation paths. The implementation log notes it was added so `just check` can run under the current TypeScript toolchain.

**Status:** Fixed. The `tsconfig.json` setting now includes an inline rationale pointing to `features/spine-api/implementation-log.md`.

**Why it matters:** This is not a functional defect, but compiler-warning suppressions are broad project policy changes. Keeping them tied to a feature branch without a task or plan note can hide unrelated toolchain debt.

**Suggested fix:**

```json
// Before
"skipLibCheck": true, /* Skip type checking all .d.ts files. */
"ignoreDeprecations": "6.0"

// After, if this belongs to this feature
"skipLibCheck": true, /* Skip type checking all .d.ts files. */
"ignoreDeprecations": "6.0" /* Required for current TypeScript check compatibility; see implementation-log.md */

// Or move the tsconfig change to a separate maintenance task/commit.
```

## Required Before Verification (Phase 7)

No CRITICAL or HIGH findings were identified.

## Suggested Improvements (Optional)

All suggested improvements from this review have been implemented.

## Test Coverage Gap Analysis

| Requirement | Test Status | Gap |
|------------|:----------:|-----|
| FR-001 / US1 | Adequate | Captures route accepts cursor and paginates first, next, final, `all=1`, invalid cursor, and timestamp ties. |
| FR-002 / US2 | Adequate | Files route accepts cursor and paginates first, next, final, invalid cursor, and timestamp ties. |
| FR-003 | Adequate | Both list response tests assert `{ items, next_cursor }`. |
| FR-004 | Adequate | Final-page tests assert `next_cursor: null`. |
| FR-005 | Adequate | Tie-breaker tests cover same-timestamp captures and files. |
| FR-006 | Adequate | Malformed cursor tests assert `400` and `{ error: 'Invalid cursor' }`. |
| FR-007 | Adequate | Excessive-limit tests now seed enough rows to prove caps of `200` and `500`. |
| FR-008 / NFR-002 | Adequate | Cursor code encodes only kind, version, timestamp, and id; no paths, hashes, text, or user content. |
| FR-009 / US3 | Adequate | Surface wrappers normalize first-page behavior while exposing page helpers. |

## Pattern Consistency

| Existing Pattern | Followed in New Code? | Notes |
|-----------------|:--------------------:|-------|
| Elysia route modules own direct SQLite queries without ORM | Yes | Pagination stays in `captures.ts` and `files.ts`, as planned. |
| Auth model remains middleware-owned for non-agent `/api/*` routes | Yes | No route-level bypass or new public group was added. |
| Error responses use simple `{ error }` objects for JSON API routes | Yes | Invalid cursors return `{ error: 'Invalid cursor' }` with status `400`. |
| Route tests use `buildTestApp`, `req`, and real SQLite helpers | Yes | New coverage follows existing route test structure. |
| Surface API wrappers use `apiFetch` and typed return values | Yes | New page interfaces match existing API module style. |

## Verification Run During Review

```bash
bun test tests/routes/captures.test.ts tests/routes/files.test.ts
```

Result: 49 passed, 0 failed, 102 assertions.

## Review Checklist

- [x] All CRITICAL findings addressed
- [x] All HIGH findings addressed or acknowledged
- [x] Test coverage adequate for Must Have stories
- [x] No security vulnerabilities in new code
