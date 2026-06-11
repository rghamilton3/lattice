---
parent_branch: main
feature_number: "017"
status: Complete
created_at: 2026-06-08T00:00:00+00:00
references_consulted:
  - specs/005-attachments/spec.md
  - docs/ADR/0001-remote-inference-graceful-degradation.md
  - docs/ADR/README.md
  - docs/lattice-development-plan.md
  - spine/src/search.ts
  - spine/src/routes/attachments.ts
---

# Feature Specification: Attachment Extraction and Image Description

**Feature Branch**: `worktree-feat+attachment-exdtraction-and-image-description`

**Created**: 2026-06-08

**Status**: In Progress

**Extends**: `specs/005-attachments` (builds on the existing attachment infrastructure)

## Overview

Every attachment stored in Lattice currently has only its filename and metadata indexed for search. A PDF, DOCX, or scanned image cannot be found by its contents. This feature makes attachment content searchable by extracting text at upload time and, for image-only content, generating a natural-language description via the inference endpoint.

The feature is tiered by capability:

- **Tier 0** (always-on): Plain text, CSV, Markdown, PDF (via subprocess), and Office formats (DOCX, PPTX, XLSX via subprocess) have their text extracted. No inference endpoint required.
- **Tier 1** (requires inference): Images and PDFs with no text layer are OCR-processed via the inference endpoint. Images that produce no text receive a human-readable AI-generated description that the user can edit and confirm.

Every attachment has an `extraction_status` that tracks where it is in this pipeline so the system is always consistent and stragglers are never silently lost.

## User Scenarios and Testing

### User Story 1 - Searchable Document Attachments (Priority: P1)

A user uploads a PDF or Word document to a capture. Later, searching for a phrase from inside that document returns the capture as a result.

**Why this priority**: The entire value proposition of the feature. If text extraction does not reach search, the feature provides nothing.

**Independent Test**: Upload a PDF containing a known phrase to a capture. Run a search for that phrase. Confirm the capture-attachment appears in results.

**Acceptance Scenarios**:

1. **Given** a capture with a PDF attachment, **When** the user searches for text inside the PDF, **Then** the capture-attachment appears in search results.
2. **Given** a capture with a DOCX attachment, **When** the user searches for a phrase from the document body, **Then** the capture-attachment appears in results.
3. **Given** a capture with a plain text or Markdown file attached, **When** the user searches for content from that file, **Then** the capture-attachment appears in results.
4. **Given** a working document with an attached spreadsheet (XLSX), **When** the user searches for cell content from the spreadsheet, **Then** the working-attachment appears in results.

---

### User Story 2 - Consistent Extraction Status (Priority: P1)

A user uploads an attachment and can later see whether its content has been indexed. Attachments that fail extraction or are waiting are never silently ignored.

**Why this priority**: Without visible status, a user cannot tell whether a document is unsearchable because extraction failed or because their query is off. This prevents invisible data loss.

**Independent Test**: Upload an attachment and query its `extraction_status` via the API. Confirm it transitions from `pending` to `done` (or `failed`/`dark`) after processing.

**Acceptance Scenarios**:

1. **Given** a newly uploaded attachment, **When** querying the API, **Then** the `extraction_status` is `pending`.
2. **Given** a successfully processed text document, **When** extraction completes, **Then** `extraction_status` is `done` and the content is findable by search.
3. **Given** an attachment where extraction fails, **When** the subprocess or inference call errors, **Then** `extraction_status` is `failed` and the filename metadata remains searchable.
4. **Given** an image attachment with no extractable text, **When** OCR produces no content, **Then** `extraction_status` is `dark` and the system proceeds to generate a description.
5. **Given** spine restarts with pending attachments, **When** it starts up, **Then** all `pending` attachments are swept and processed before normal operation resumes.

---

### User Story 3 - Searchable Image Descriptions (Priority: P2)

A user uploads an image (screenshot, photo, diagram) to a capture. Lattice automatically generates a description. The user can search for concepts in the image using natural language. The user can also read, edit, and confirm the description.

**Why this priority**: Images are common attachments but opaque to text search without this. Editability ensures incorrect descriptions do not mislead future searches.

**Independent Test**: Upload an image with a visible subject (e.g., a diagram of a system). Confirm a description is generated, that searching for the subject finds the capture-attachment, and that editing the description causes search to reflect the updated text.

**Acceptance Scenarios**:

1. **Given** an image attachment with no extractable text, **When** the VLM generates a description, **Then** the description text is indexed and findable via search.
2. **Given** an existing unconfirmed description, **When** the user edits it via the API, **Then** the search index is updated to reflect the new `final_text`.
3. **Given** a confirmed description, **When** the system attempts to re-run the description (e.g., model update), **Then** the confirmed description is preserved and not overwritten.
4. **Given** an unconfirmed description, **When** the system re-runs description generation (e.g., better model becomes available), **Then** the old row is superseded by the new one and `final_text` reflects the latest.
5. **Given** a description without inference available, **When** the inference endpoint is down, **Then** the attachment stays `dark` and is retried when the endpoint recovers, consistent with how embedding backfill works.

---

### Edge Cases

- Attachment file is deleted from disk before extraction runs.
- Subprocess tool (pdftotext, pandoc) is not installed on the server.
- PDF has a text layer but it is garbled (scanned + bad OCR baked in) - produces minimal text; system marks `done` with what it got.
- Image contains only a logo or decorative art - VLM description handles it; user can edit.
- Inference endpoint is down when Tier 1 is attempted - stays `pending` or `dark`, retried on recovery.
- Attachment is a supported extension but the file is corrupt - subprocess fails; status becomes `failed`.
- A `dark` attachment already has a confirmed description; a re-run must not overwrite it.
- Working doc is deleted while its attachment's extraction is pending - orphaned row, handled gracefully.
- Very large file (hundreds of MB) - subprocess may produce large text; truncate if necessary to avoid QMD limits.

## Requirements

### Functional Requirements

- **FR-001**: Every newly uploaded `capture_attachment` and `working_attachment` MUST have `extraction_status` set to `pending` at the moment of storage.
- **FR-002**: On spine startup, all attachments with `extraction_status = 'pending'` MUST be swept and submitted for extraction before the server accepts user-facing requests. (Startup sweep ensures restarts do not leave stragglers.)
- **FR-003**: The extraction pipeline MUST support four terminal statuses: `pending` (in-flight or waiting), `done` (text extracted and indexed), `failed` (extraction error; filename metadata still searchable), `dark` (no text found; description flow triggered).
- **FR-004**: Tier 0 extraction MUST handle plain text (text/plain), CSV (text/csv), Markdown (text/markdown), PDF (application/pdf), DOCX (application/vnd.openxmlformats-officedocument.wordprocessingml.document), PPTX (application/vnd.openxmlformats-officedocument.presentationml.presentation), and XLSX (application/vnd.openxmlformats-officedocument.spreadsheetml.sheet).
- **FR-005**: For text/CSV/Markdown attachments, Tier 0 extraction MUST read content inline (no subprocess).
- **FR-006**: For PDF, DOCX, PPTX, and XLSX attachments, Tier 0 extraction MUST invoke a subprocess tool and treat non-zero exit codes as `failed`.
- **FR-007**: When Tier 0 extraction produces empty text (or text below a minimum meaningful threshold) on an image-capable content type, the pipeline MUST escalate to Tier 1 (OCR via inference endpoint).
- **FR-008**: Tier 1 OCR MUST call the inference endpoint and treat a non-empty result as `done` and an empty result as `dark`.
- **FR-009**: When `extraction_status` is set to `dark`, the pipeline MUST invoke the inference endpoint's VLM to generate a description and write it to `attachment_descriptions` with `confirmed = false`.
- **FR-010**: `attachment_descriptions` MUST store: `attachment_kind` ('capture' | 'working'), `attachment_id`, `produced_text` (raw model output), `final_text` (what is indexed; initially equal to `produced_text`), `confirmed` (boolean, default false), `model_id`, `supersedes` (nullable reference to previous row id), and `created_at`.
- **FR-011**: The search index for an attachment in `dark` status MUST use `final_text` from `attachment_descriptions` rather than the filename-only entry.
- **FR-012**: Re-running description generation on an attachment with an **unconfirmed** description MUST create a new row with `supersedes` pointing to the previous row and update `final_text` in the search index.
- **FR-013**: Re-running description generation on an attachment with a **confirmed** description MUST leave the existing row unchanged.
- **FR-014**: The API MUST expose `extraction_status` on attachment list and detail responses.
- **FR-015**: The API MUST expose a way to read and update `final_text` and `confirmed` for a description.
- **FR-016**: When the inference endpoint is unavailable during Tier 1 or description generation, the attachment MUST remain in its current status and be retried when the endpoint recovers (aligned with embedding backfill retry behavior per ADR-0001).
- **FR-017**: Extraction MUST run asynchronously relative to the HTTP upload response. The upload route returns immediately; extraction runs in the background.
- **FR-018**: The system MUST degrade gracefully when Tier 0 subprocess tools are not installed: the extraction attempt produces `failed` status; other attachments continue.

### Key Entities

- **extraction_status**: The lifecycle state of an attachment's content extraction. One of `pending`, `done`, `failed`, `dark`. Added as a column to both `capture_attachments` and `working_attachments`.
- **AttachmentDescription**: A record of AI-generated descriptive text for a `dark` attachment. Attributes: id, attachment_kind, attachment_id, produced_text, final_text, confirmed, model_id, supersedes, created_at.
- **Extraction pipeline**: The in-process async job that reads an attachment's binary, runs Tier 0/Tier 1 processing, and writes the result back to the DB and search index.
- **Tier 0**: Content extraction using only local tools (inline read or subprocess). No network calls. Always available.
- **Tier 1**: Content extraction or description using the remote inference endpoint. Requires a running VLM/OCR model on the endpoint. Degrades gracefully when unavailable.

## Success Criteria

### Measurable Outcomes

- **SC-001**: After uploading a PDF or DOCX, the text inside the document is findable via search within 30 seconds on a typical home server with Tier 0 subprocess tools available.
- **SC-002**: After uploading an image with visible text (e.g., a screenshot of a code snippet), the text is findable via search within 60 seconds when the inference endpoint is healthy and a suitable OCR model is loaded.
- **SC-003**: Every attachment returned by the API includes an `extraction_status` field; no attachment row lacks a status.
- **SC-004**: When the inference endpoint is down, uploading a new image attachment does not produce a server error; the upload succeeds and the attachment queues for description when the endpoint recovers.
- **SC-005**: A confirmed description is never overwritten by an automated re-run; only user-initiated edits change it.
- **SC-006**: On spine restart, all previously `pending` attachments resume processing without manual intervention.
- **SC-007**: An attachment whose Tier 0 subprocess is missing reaches `failed` status rather than blocking other extractions.

## Assumptions

- The inference endpoint is the same OpenAI-compatible endpoint already configured for QMD (per `config.toml` / `QMD_EMBED_API_URL`). Separate config keys are added for the OCR model and VLM model names (e.g., `ocr_model` and `vlm_model` under `[spine.qmd]`).
- Suitable OCR and VLM models are the user's responsibility to load on the inference endpoint. Lattice does not deploy or manage models.
- Subprocess tools for PDF extraction (`pdftotext` from poppler-utils) and Office formats (`pandoc` or equivalent) must be installed on the server separately. The feature documents which tools it needs; it does not bundle or install them.
- Extraction runs in-process on the Bun runtime using `Bun.spawn()`. No separate worker process is introduced (per ADR backlog decision: "In-process job queue + subprocessing, rather than a separate extraction worker").
- Text truncation for very large extracted text is acceptable to prevent QMD limits; a reasonable ceiling (e.g., 100,000 characters) is chosen and documented.
- `specs/005-attachments` explicitly marked OCR and text extraction as out of scope for that feature. This feature supersedes those scope notes; the rest of the 005 spec remains unchanged.
- The `attachment_descriptions.supersedes` column creates a singly-linked history chain; the system does not need to traverse more than one level (current row is always the head).

## Sources

This spec was generated by consulting the following references (per `.specswarm/references.md`):

| Source | Sections informing this spec |
|--------|------------------------------|
| `specs/005-attachments/spec.md` | Scope exclusions (OCR out of scope - now superseded); entity definitions; FR-006 (path safety); existing attachment kinds |
| `docs/ADR/0001-remote-inference-graceful-degradation.md` | §Consequences: `extraction_status` durable-queue shape; degradation on endpoint outage; backfill retry pattern |
| `docs/ADR/README.md` | §Backlog: in-process queue decision; one unified job abstraction decision |
| `docs/lattice-development-plan.md` | §201: VLM for OCR/image annotation as future workload; inference capacity planning note |
| `spine/src/search.ts` | `attachmentToMarkdown` (current index format - to be extended with extracted text); `attachmentsMdDir` / `workingAttachmentsMdDir` paths; backfill retry patterns |
| `spine/src/routes/attachments.ts` | `writeAttachmentIndex` call sites; upload flow (where `pending` status must be set) |
| `memory/project_remote_inference_fallback.md` | Remote-only QMD; backfill via retry loop - applied to Tier 1 retry behavior |
