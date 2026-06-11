# Quality Analysis Report - Feature 019: Agent Office Extraction

**Generated**: 2026-06-10
**Branch**: 019-agent-office-extraction
**Scope**: Merge diff vs `main` (agent/src/cache.rs, agent/src/extract.rs, agent/src/scan.rs, config.toml.example, specs/019)

---

## Overall Quality Score: 93/100

```
===============================================
Quality Analysis Report - Feature 019
===============================================

Overall Quality Score: 93/100 PASS

Breakdown:
- Test Coverage:   95/100
- Architecture:    95/100
- Documentation:   90/100
- Performance:     95/100
- Security:        100/100

Issues Found:
- Critical:  0
- High:      0
- Medium:    1
- Low:       2

Total Issues: 3
```

---

## 1. Test Results (gates)

- **agent (Rust)**: `cargo test` - 21 pass, 0 fail (13 new tests in this diff)
- **clippy**: `cargo clippy --all-targets` - clean, no warnings
- **rustfmt**: `cargo fmt --check` - clean
- spine/ and surface/ untouched by this diff (no TS changes); last full run 2026-06-09: 463 pass, 0 fail

### New test coverage in this diff
- `cache.rs`: legacy-schema migration backfill, migration idempotency, skipped-row round trip, skipped-to-indexed overwrite (4 tests)
- `extract.rs`: subprocess dispatch per MIME (pdf/docx/pptx/xlsx/doc), unknown-MIME None, truncation edge cases incl. char boundaries (9 tests)
- `scan.rs`: retry-skip generation logic, UTF-8 fallback accept/reject (5 tests)

---

## 2. Architecture

Clean design:
- Outcome tracking (`indexed`/`skipped`) as named constants, not magic strings
- `EXTRACTOR_GENERATION` bump pattern gives deterministic retry of previously skipped files when capabilities grow
- `subprocess_spec()` mirrors `spine/src/extract.ts` SUBPROCESS_TYPES and documents the parity contract
- Additive, idempotent SQLite migrations with correct defaults for pre-existing rows
- Pattern-matched files are never silently dropped: UTF-8 fallback to text/plain, visible warn-once for binary

No anti-patterns introduced.

---

## 3. Findings

### MEDIUM
1. **`cache.rs` `write()` swallows DB errors via `.ok()`** (`agent/src/cache.rs:113`)
   - A failed cache upsert is silent; the file would be re-processed next pass (self-healing) but persistent DB failures would never surface.
   - Pre-existing pattern (old `upsert` did the same); carried forward, not introduced.
   - Fix: log at `warn!` on `Err` instead of discarding.

### LOW
2. **Migration `let _ = ALTER TABLE ...` swallows all errors**, not just "duplicate column" (`agent/src/cache.rs:151-156`)
   - Documented trade-off in comment; a genuinely broken DB would fail loudly on the subsequent query anyway.
3. **`config.toml.example` extractor comment can drift** from the actual `subprocess_spec()` set; no single source of truth.

---

## 4. Security

- Subprocess invocation uses fixed command names (`pdftotext`, `pandoc`) with the path passed as an argument vector - no shell interpolation, no injection surface.
- No secrets, no network changes, no new input parsing beyond UTF-8 validation.
- Score: 100/100

---

## 5. Performance

- Fast path (mtime+size cache hit) preserved; generation check is a cheap in-memory comparison.
- `truncate_text` is O(n) single pass with correct char-boundary handling; 100k char ceiling mirrors spine.
- Score: 95/100

---

## Recommendations

- MEDIUM #1: add `warn!` logging on cache write failure (small follow-up, not ship-blocking)
- LOW #2/#3: optional cleanups

Estimated impact of fixes: 93 -> 96.
