# Research: Agent Office Document Extraction & Watch Pattern Reconciliation

## R1: Office extraction mechanism

**Decision**: Shell out to `pandoc` per file, exactly mirroring the spine's subprocess table
(`spine/src/extract.ts` SUBPROCESS_TYPES): `pandoc --from={docx|pptx|xlsx|doc} --to=plain <path>`.

**Rationale**:
- Parity is the explicit goal (FR-1/FR-2); using the same tool with the same arguments
  guarantees equivalent output text.
- The agent already has the subprocess precedent: `extract_pdf` shells out to `pdftotext`
  and converts a missing binary into an actionable error ("install poppler-utils").
- No Rust crate dependency added; docx/pptx/xlsx parsing crates (docx-rs, calamine, etc.)
  would produce *different* text from the spine and bloat the agent binary.

**Alternatives considered**:
- Rust crates (`docx-rs`, `calamine`, custom zip+XML): rejected - output divergence from
  spine, three new dependencies, more code to maintain.
- LibreOffice headless: rejected - much heavier install, slower startup per file.

## R2: MIME detection for the new types

**Decision**: Rely on `mime_guess` (already a dependency). Verified mappings:
- `.docx` → `application/vnd.openxmlformats-officedocument.wordprocessingml.document`
- `.pptx` → `application/vnd.openxmlformats-officedocument.presentationml.presentation`
- `.xlsx` → `application/vnd.openxmlformats-officedocument.spreadsheetml.sheet`
- `.doc` → `application/msword`
- `.org` → `application/vnd.lotus-organizer` (the silent-skip culprit; handled by R3)

**Rationale**: same detection path the agent already uses; the spine keys its subprocess
table on these exact MIME strings, so the payload `mime_type` field stays consistent.

## R3: UTF-8 fallback for pattern-matched files with no extractor

**Decision**: In `process_file`, the file content is already fully read into memory for
hashing (`std::fs::read`). When `extract_text` has no handler for the detected MIME, attempt
`String::from_utf8(content)`:
- Valid UTF-8 → index it, reporting the payload `mime_type` as `text/plain` (the detected
  guess was wrong by construction - the bytes are text).
- Invalid UTF-8 → `warn!` with path + reason, count as skipped, record skip in cache (R4).

**Rationale**: zero extra I/O (bytes already in memory), zero new dependencies, and the
clarified behavior: a configured pattern expresses intent, so text-like content is indexed.
Reporting `text/plain` instead of the bogus guess (e.g. Lotus Organizer for `.org`) keeps the
spine's downstream type handling sane.

**Alternatives considered**:
- Lossy conversion (`from_utf8_lossy`) for almost-text files: rejected - silently corrupting
  content is worse than a visible skip; UTF-16/legacy encodings are out of scope.
- Extension→MIME override config: rejected in clarification (config burden on every user).

## R4: Remembering skip decisions (FR-9)

**Decision**: Extend the cache row with two columns and a code-level generation constant:

- `outcome TEXT NOT NULL DEFAULT 'indexed'` - `'indexed'` or `'skipped'`.
- `extractor_gen INTEGER NOT NULL DEFAULT 0` - the extractor-capability generation that
  produced the row.
- A constant `EXTRACTOR_GENERATION: i64` in the agent source, bumped whenever the supported
  extraction set changes (this feature sets it to `1`).

Skip flow: when a file is skipped as unextractable, `upsert` the row with `outcome='skipped'`
and the current generation, after emitting the one warning. Fast-path check: a cache hit with
matching mtime/size short-circuits *unless* `outcome='skipped'` AND `extractor_gen <
EXTRACTOR_GENERATION`, in which case the file is reprocessed (the agent may have learned to
extract it since).

**Rationale**: satisfies warn-once + no-rework on unchanged files (clarified behavior), and
solves the trap where a future extractor addition would never retry previously-skipped files
because their mtime/size still match. Existing rows migrate via `ALTER TABLE ... ADD COLUMN`
with defaults (`'indexed'` / `0`), which is exactly right: previously cached rows were all
successfully indexed.

**Alternatives considered**:
- No schema change, just don't cache skips: rejected - re-reads/re-hashes every binary file
  every pass and re-warns forever (rejected in clarification).
- Cache skips without a generation marker: rejected - permanently blinds the agent to files
  it later learns to extract.

## R5: Truncation ceiling (FR-8)

**Decision**: Truncate extracted text to 100,000 characters in the agent before POSTing,
cutting at the last space before the limit (port of `truncate()` in `spine/src/extract.ts`,
ceiling documented in spec 017).

**Rationale**: keeps agent payloads within what the spine itself would produce for the same
file; avoids megabyte POSTs for huge spreadsheets exported to text.

## R6: SQLite schema migration for the cache

**Decision**: Idempotent `ALTER TABLE file_cache ADD COLUMN ...` at cache open, ignoring the
"duplicate column name" error (the same tolerant style the cache already uses - its writes
`.ok()` errors away). No version table needed for two additive columns.

**Rationale**: the cache is a private, disposable artifact (`agent.db` in the platform data
dir); worst case it can be deleted and rebuilt. A full migration framework is overkill.

## R7: Testing strategy (constitution P5)

**Decision**:
- Unit tests in `extract.rs`: MIME→handler dispatch (which MIME strings route to pandoc and
  with which `--from` value), truncation behavior (boundary, space-cutting, under-limit).
- Unit tests in `scan.rs`: UTF-8 fallback decision logic (valid text bytes → index as
  `text/plain`; invalid bytes → skip), extractor-generation retry rule.
- Subprocess invocations (pandoc/pdftotext) are not exercised in unit tests - the dispatch
  table is tested, the spawn path follows the existing `extract_pdf` pattern. This matches
  spine's approach where pandoc must be installed on the host.

**Rationale**: deterministic tests with no external tool requirement in CI; the logic that
can regress (dispatch, fallback, caching rules, truncation) is fully covered.
