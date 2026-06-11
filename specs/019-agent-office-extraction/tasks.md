# Tasks: Agent Office Document Extraction & Watch Pattern Reconciliation

<!-- Tech Stack Validation: PASSED -->
<!-- Validated against: .specswarm/tech-stack.md (2026-06-07) -->
<!-- No prohibited technologies found; no new libraries introduced -->

**Feature**: 019-agent-office-extraction
**Input**: spec.md, plan.md, research.md, data-model.md, quickstart.md
**Tests**: Required (constitution P5 - tests accompany features)

## User story mapping

- **US1** (P1): Office documents become searchable (spec Scenario 1; FR-1, FR-2, FR-3, FR-8)
- **US2** (P2): Pattern-matched files are never silently dropped - the .org case (Scenarios 2-3; FR-4, FR-5, FR-6)
- **US3** (P3): Skip decisions are remembered - warn once, stay fast (FR-9, SC-5)

## Phase 1: Setup

No setup tasks - existing Rust workspace, no new dependencies.

## Phase 2: Foundational

- [X] T001 Extend agent cache schema and API for skip tracking: idempotent `ALTER TABLE file_cache ADD COLUMN outcome TEXT NOT NULL DEFAULT 'indexed'` and `extractor_gen INTEGER NOT NULL DEFAULT 0` at `open()` (ignore duplicate-column errors); add `outcome` and `extractor_gen` to `FileState` and to `get()`; extend `upsert` to record outcome + generation (indexed writes) and add `upsert_skipped` (skip writes); unit tests covering migration idempotency on an existing db, default backfill (`'indexed'`/`0`), and round-trip of skipped rows — agent/src/cache.rs

## Phase 3: US1 - Office document extraction parity (MVP)

- [X] T002 [US1] Replace the ad-hoc PDF special case in `extract_text` with a subprocess dispatch table mirroring spine `SUBPROCESS_TYPES`: pdftotext for `application/pdf` (args `<path> -`), pandoc `--from={docx|pptx|xlsx|doc} --to=plain <path>` for the four Office MIME types from data-model.md; actionable missing-binary errors (`pandoc not found - install pandoc`, keep the poppler-utils message for pdftotext); add `pub const EXTRACTOR_GENERATION: i64 = 1` and `truncate_text` (100,000-char ceiling, cut at last space, port of spine `truncate()`); apply truncation to all extraction results; unit tests for MIME→tool/args dispatch (including `;charset`-free exact match behavior), unsupported-MIME → `None`, and truncation boundaries (under-limit passthrough, exact limit, space-cut, no-space fallback) — agent/src/extract.rs

**Checkpoint**: docx/pptx/xlsx/doc files in a watch directory are extracted and indexed; missing pandoc produces a counted, actionable error (SC-1, SC-4 verifiable via quickstart.md steps 1-3, 5).

## Phase 4: US2 - Watch pattern reconciliation (the .org case)

- [X] T003 [US2] Add UTF-8 fallback in `process_file`: when `extract_text` returns `None` for a pattern-matched file, attempt `String::from_utf8(content)` (bytes already read for hashing - no second read); on success index with `mime_type = "text/plain"` and truncated text; on failure emit a single `warn!` naming path, detected mime, and reason, then return `Skipped`; extraction failures for supported types must keep propagating as `Err` (counted in `errors`, surfaced in status); unit tests for the fallback decision: valid UTF-8 bytes → index-as-text path, invalid bytes → warn-skip path — agent/src/scan.rs

**Checkpoint**: `.org` files matched by a configured pattern are indexed as plain text; binary files (e.g. `.zip`) produce a visible warning, never a silent drop (SC-2, SC-3 via quickstart.md).

## Phase 5: US3 - Remembered skip decisions

- [X] T004 [US3] Cache skip decisions and honor the extractor generation: on the warn-skip path from T003, call `cache.upsert_skipped(path, mtime, size, hash, EXTRACTOR_GENERATION)` so the warning fires once; amend both cache fast paths in `process_file` (mtime/size match and hash match) to NOT short-circuit when the cached row has `outcome = 'skipped'` AND `extractor_gen < EXTRACTOR_GENERATION` (retry after capability growth); unit tests for the short-circuit rule matrix: indexed+unchanged → skip, skipped+current-gen+unchanged → skip without warn, skipped+older-gen → reprocess, changed file → reprocess — agent/src/scan.rs

**Checkpoint**: second scan pass over an unchanged directory does no re-reads of skipped files and emits no repeat warnings (FR-9, SC-5 via quickstart.md step 4).

## Phase 6: Polish & cross-cutting

- [X] T005 [P] Update the example config: extend the `[[agent.watch]]` patterns example to include Office and Org globs (e.g. `"**/*.docx"`, `"**/*.org"`) and add a comment noting pandoc is required for docx/pptx/xlsx/doc extraction — config.toml.example
- [X] T006 Full verification pass: `cargo test` green in agent/, `cargo clippy` clean, `cargo fmt` applied; confirm no diffs outside agent/ and config.toml.example; re-check FR-1..FR-9 against the implementation — agent/

## Dependencies

```
T001 (cache schema) ──┬────────────► T004 (uses upsert_skipped + outcome/gen)
T002 (extract table) ─┼─► T003 (fallback after extract_text None) ─► T004
                      └──────────────────────────────────────────────► T006
T005 independent ─────────────────────────────────────────────────────► T006
```

- T001 and T002 are parallelizable (different files).
- T003 → T004 sequential (both edit agent/src/scan.rs).
- T005 can run any time; T006 last.

## Implementation strategy

MVP = Phase 3 (US1) after T001/T002 foundations. Each checkpoint is independently testable
via quickstart.md. Total: 6 tasks, max 2 parallel - sequential execution is appropriate.
