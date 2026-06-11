# Research: Attachment Extraction and Image Description

**Feature**: 017-attachment-extraction
**Date**: 2026-06-08

---

## Decision 1: Where to persist extracted text across restarts

**Decision**: Add `extracted_text TEXT NOT NULL DEFAULT ''` to `capture_attachments` and `working_attachments` alongside `extraction_status`.

**Rationale**: `initSearch()` reconstructs attachment markdown files from DB rows on startup (writing them if absent). Without the extracted text in the DB, a QMD index rebuild would silently drop all extracted content and fall back to filename-only. The `attachment_descriptions.final_text` column covers the dark-attachment case; the inline extracted text needs a symmetric home.

**Alternatives considered**:
- *Rely on QMD's own DB for persistence* - rejected because QMD's DB is intentionally opaque (`lattice.qmd.db`) and rebuild-from-source is the stated recovery path for the QMD layer.
- *Write text to a sidecar file* - more filesystem state to manage; column is simpler.

---

## Decision 2: Subprocess tooling for Tier 0

**Decision**: Use `pdftotext` (poppler-utils) for PDF and `pandoc` for DOCX/PPTX/XLSX.

**Rationale**:
- `pdftotext` is the canonical tool for PDF text extraction on Linux; handles layered text without the heavyweight LibreOffice startup cost.
- `pandoc` supports all three Office formats (docx, pptx, xlsx) in a single dependency; available in every major package manager.
- Both are missing-tool-resilient: the extraction module catches non-zero exit codes and ENOENT errors, sets `extraction_status = 'failed'`, and continues with other attachments.

**Exact commands**:
- PDF: `pdftotext <stored-path> -` (writes to stdout, `-` is the output target)
- DOCX: `pandoc --from=docx --to=plain <stored-path>`
- PPTX: `pandoc --from=pptx --to=plain <stored-path>`
- XLSX: `pandoc --from=xlsx --to=plain <stored-path>`

**Text truncation**: Extracted text longer than 100,000 characters is truncated at the last whitespace boundary before the limit. QMD has no hard character limit per document but very long texts degrade embedding quality; 100k chars covers typical office documents.

**Alternatives considered**:
- *LibreOffice headless* - comprehensive format support but ~2 second cold-start per document; not worth it for a homelab with a small attachment count.
- *ssconvert (gnumeric) for xlsx* - accurate for spreadsheet data but introduces a second tool dependency.

---

## Decision 3: Inference endpoint for Tier 1 (OCR and VLM)

**Decision**: Use the same OpenAI-compatible endpoint already configured in `[spine.qmd]` in `config.toml`. Add `ocr_model` and `vlm_model` keys under `[spine.qmd]`. Send vision requests via `POST /v1/chat/completions` with base64-encoded image.

**Rationale**: The inference endpoint is already configured and circuit-broken in spirit (via QMD degradation handling and the embedding-backfill retry loop). Reusing the same base URL avoids a separate config section; model names distinguish OCR-capable vs. description-capable models.

**Config additions** (under `[spine.qmd]`):
```toml
ocr_model = "minicpm-v"        # or "llava" - must support vision
vlm_model = "minicpm-v"        # same model is fine; can differ if VLM != OCR
```

If `ocr_model` is absent, Tier 1 is skipped (image-type attachments stay `pending` until a model is configured). If `vlm_model` is absent, dark-status attachments stay `dark` without a description.

**Prompts**:
- OCR: `"Extract all text from this image exactly as it appears. Return only the extracted text with no commentary or explanation. If there is no text, return an empty response."`
- VLM: `"Describe this image in 2-3 sentences. Focus on what is shown: objects, people, diagrams, text style, or visual content. Be concise and factual."`

**Auth**: Same `embed_api_key` from `[spine.qmd]` is used (or `QMD_EMBED_API_KEY` env var). A separate key can be added later; not needed now since the same server handles all endpoints.

**Alternatives considered**:
- *Separate `[spine.inference]` config section* - cleaner conceptually but adds new config namespace and breaks the pattern established by `[spine.qmd]`.
- *Calling QMD's internal VLM path* - QMD does not expose a vision/OCR surface in its public API.

---

## Decision 4: In-process async extraction queue

**Decision**: Extract in-process on the Bun event loop using a serialized `Promise` chain (same lock pattern as `refreshIndex()`), not a separate worker process.

**Rationale**: Per the ADR backlog decision: "In-process job queue + subprocessing, rather than a separate extraction worker." The subprocess actually leaves the process (via `Bun.spawn`), so CPU-intensive work is genuinely off the main thread. The coordination overhead of a worker process is not justified for a single-user homelab.

**Queue design**:
- A `_extractionLock: Promise<void>` (same pattern as `_indexLock` in `search.ts`) serializes extraction so one attachment is processed at a time.
- `queueAttachment(id, kind, storedPath, contentType)` appends to the chain; returns immediately.
- `sweepPending(db, attachmentsDir)` on startup scans all `pending` rows and enqueues them.
- No retry inside the queue - a failure sets `failed` immediately. The startup sweep is the natural retry surface: restart the server to retry `failed` attachments by resetting their status to `pending` first. (A future `/api/attachments/:id/reextract` endpoint can reset on demand.)

**Alternatives considered**:
- *Per-attachment immediate async (not serialized)* - rejected because concurrent `Bun.spawn` calls for large attachments can exhaust file descriptors; serialization is cheap given the single-user load.
- *Bun Worker* - correct for CPU-bound work but the subprocess already handles that; a Worker adds complexity with no benefit.

---

## Decision 5: `attachment_descriptions` linkage model

**Decision**: `attachment_descriptions` stores `(attachment_kind TEXT, attachment_id INTEGER)` as the FK rather than two separate nullable FKs.

**Rationale**: Both `capture_attachments` and `working_attachments` have integer primary keys but they live in different tables. A discriminated union column (`attachment_kind IN ('capture', 'working')`) plus `attachment_id` is the same pattern used by `annotations` (`target_kind`, `target_id`). This keeps the table schema simple and avoids nullable FK anti-patterns.

**Alternatives considered**:
- *Two nullable FK columns (`capture_attachment_id`, `working_attachment_id`)* - allows DB-level FK enforcement but adds nullable columns and complicates queries.

---

## Decision 6: Search index update for extracted text

**Decision**: `writeAttachmentIndex` and `writeWorkingAttachmentIndex` in `search.ts` gain an optional `extractedText?: string` parameter. When present and non-empty, it is appended to the markdown body below the frontmatter (same position as `text` in captures). `initSearch` reads `extracted_text` from the DB to reconstruct accurate index files on startup.

**Rationale**: Minimal change to the established markdown-file-per-document pattern. The QMD index sees the combined frontmatter + extracted text as the document body.

**Dark attachments**: When `extraction_status = 'dark'`, the index file body contains the `final_text` from `attachment_descriptions`. When a description is updated, the index file is rewritten and `refreshIndex()` is called.

---

## Decision 7: Startup sweep timing

**Decision**: `sweepPending(db, attachmentsDir)` is called in `index.ts` immediately after `await initSearch(db)`, before the HTTP server starts listening.

**Rationale**: The spec requires (FR-002) that pending attachments are swept "before the server accepts user-facing requests." Calling it pre-listen satisfies this. Because sweep is async and uses the same queue lock, it does not block the event loop for other startup tasks; the listen call is what gates user traffic.

**Trade-off**: A spine with thousands of pending attachments will delay startup proportionally. Acceptable for single-user homelab; document this in quickstart.md.
