# Implementation Plan: Attachment Extraction and Image Description

**Feature**: 017-attachment-extraction
**Branch**: `worktree-feat+attachment-exdtraction-and-image-description`
**Date**: 2026-06-08
**Status**: Ready for implementation

---

## Technical Context

**Stack**: TypeScript / Bun / Elysia (spine only - no surface changes required)

**New modules**:
- `spine/src/extract.ts` - Tier 0 and Tier 1 text extraction
- `spine/src/describe.ts` - VLM description generation for dark attachments
- `spine/src/extraction-queue.ts` - in-process serialized extraction queue

**Modified modules**:
- `spine/src/db/rows.ts` - add `ExtractionStatus` type and new columns
- `spine/src/config.ts` - add `ocr_model` and `vlm_model` to `QmdModelsConfig`
- `spine/src/search.ts` - extend index-write functions to accept extracted text
- `spine/src/routes/attachments.ts` - set `pending` on upload; add description endpoints
- `spine/src/routes/working.ts` - set `pending` on upload; add description endpoints
- `spine/src/index.ts` - call `sweepPending()` before HTTP listen

**New migrations**:
- `spine/migrations/013_attachment_extraction.sql`
- `spine/migrations/014_attachment_descriptions.sql`

**New tests**:
- `spine/tests/routes/attachment-extraction.test.ts`
- `spine/tests/extract.test.ts`

**External tool dependencies (server must have installed)**:
- `pdftotext` (poppler-utils) for PDF Tier 0
- `pandoc` for DOCX/PPTX/XLSX Tier 0

**External inference dependencies (optional)**:
- A vision-capable model loaded at the inference endpoint for OCR (Tier 1) and VLM (descriptions)
- Configured via `[spine.qmd] ocr_model` and `vlm_model` in `config.toml`

---

## Constitution Check

- **P1** (TypeScript only): All new files are `.ts`. No `.js` files added. ✓
- **P2** (Normalize before structuredSearch): `extract.ts` does not call `structuredSearch`. The QMD index writes go through the existing `refreshIndex()` path which calls `store.update()`, not `structuredSearch`. ✓
- **P3** (Localhost only): No new bindings or external ports. ✓
- **P5** (Tests accompany features): `attachment-extraction.test.ts` and `extract.test.ts` ship with the feature. ✓
- **P6** (No em dashes): Enforced in all authored content. ✓

---

## Implementation Tasks

### T001 - Database migrations

**Files**: `spine/migrations/013_attachment_extraction.sql`, `spine/migrations/014_attachment_descriptions.sql`

Write both migration files. Migration 013 adds `extraction_status` and `extracted_text` to both attachment tables. Migration 014 creates `attachment_descriptions` with appropriate indexes.

No code changes yet - just SQL files. They will be applied automatically by `initDb()` on next startup.

**Test**: Run `bun test` after; existing attachment tests must still pass (the new columns have defaults and are additive).

---

### T002 - DB row types and config

**Files**: `spine/src/db/rows.ts`, `spine/src/config.ts`

1. Add `ExtractionStatus = 'pending' | 'done' | 'failed' | 'dark'` type.
2. Add `extraction_status: ExtractionStatus` and `extracted_text: string` to `CaptureAttachmentRow` and `WorkingAttachmentRow`.
3. Add `AttachmentDescriptionRow` interface.
4. In `config.ts`, add `ocr_model?: string` and `vlm_model?: string` to `QmdModelsConfig`. Add `getOcrModel()` and `getVlmModel()` export functions.

**Dependencies**: T001 (DB must have new columns for TypeScript to be correct at compile time)

---

### T003 - Text extraction module

**File**: `spine/src/extract.ts`

```typescript
// Core export:
export async function extractText(
    storedFullPath: string,
    contentType: string,
): Promise<string>
```

**Tier 0 inline** (no subprocess):
- `text/plain`, `text/csv`, `text/markdown`, `text/x-markdown`: `readFileSync(storedFullPath, 'utf-8')`

**Tier 0 subprocess**:
```typescript
async function runSubprocess(cmd: string, args: string[]): Promise<string>
// Spawns with Bun.spawn; captures stdout; rejects on non-zero exit or ENOENT
```
- PDF (`application/pdf`): `pdftotext <path> -`
- DOCX: `pandoc --from=docx --to=plain <path>`
- PPTX: `pandoc --from=pptx --to=plain <path>`
- XLSX: `pandoc --from=xlsx --to=plain <path>`

**Truncation**: After extraction, `text.slice(0, 100_000)` trimmed at last whitespace boundary.

**Return**: extracted text string (may be empty). Throws on tool-not-found or subprocess error - caller catches and marks `failed`.

**Tier 1 note**: `extractText` only handles Tier 0. Tier 1 (OCR via inference) is handled separately in `extract.ts` as `ocrImage(storedFullPath): Promise<string>` using the configured `ocr_model`.

---

### T004 - OCR and VLM inference module

**File**: `spine/src/describe.ts`

```typescript
export async function ocrImage(storedFullPath: string): Promise<string>
// Returns extracted text from image; empty string if model is not configured or text not found.

export async function generateDescription(
    attachmentId: number,
    kind: 'capture' | 'working',
    storedFullPath: string,
    db: Database,
): Promise<void>
// Calls VLM, writes to attachment_descriptions table, updates index.
```

**`ocrImage` implementation**:
1. Read `vlm_model` from config - if absent, return `''`
2. Read image bytes, base64-encode
3. POST to `{embed_api_url}/chat/completions` with vision message format:
   ```json
   {
     "model": "<ocr_model>",
     "messages": [{
       "role": "user",
       "content": [
         { "type": "image_url", "image_url": { "url": "data:<content-type>;base64,<data>" } },
         { "type": "text", "text": "Extract all text from this image exactly as it appears..." }
       ]
     }],
     "max_tokens": 2000
   }
   ```
4. Return `choices[0].message.content` trimmed

**`generateDescription` implementation**:
1. Check for existing confirmed description - if found, return (no-op)
2. Call VLM with description prompt
3. DB transaction: insert new `attachment_descriptions` row with `supersedes` = current head row id (or NULL if none)
4. Update index markdown file and call `refreshIndex()`

---

### T005 - Extraction queue module

**File**: `spine/src/extraction-queue.ts`

```typescript
let _queueLock: Promise<void> = Promise.resolve();

export function queueAttachment(
    id: number,
    kind: 'capture' | 'working',
    storedFullPath: string,
    contentType: string,
    db: Database,
): void
// Appends processing of this attachment to the queue; returns immediately.

export async function sweepPending(db: Database, attachmentsDir: string): Promise<void>
// Queries all pending capture_attachments and working_attachments; enqueues each.
```

**Processing logic** (inside the queue lock):
```
1. Read storedFullPath from DB (verify it still exists)
2. Try extractText(storedFullPath, contentType)
   - If text non-empty:
       - Truncate if needed
       - UPDATE capture/working_attachments SET extraction_status='done', extracted_text=<text>
       - writeAttachmentIndex(..., text)
       - refreshIndex()
   - If text empty AND content type is image-capable:
       - Try ocrImage(storedFullPath)
         - If text non-empty: -> done path above
         - If empty or ocr_model absent: -> dark path
   - If text empty AND not image-capable:
       - UPDATE ... SET extraction_status='done', extracted_text=''
       - (file has no extractable text; indexed by filename only)
3. dark path:
   - UPDATE ... SET extraction_status='dark'
   - generateDescription(id, kind, storedFullPath, db)
4. On any thrown error:
   - UPDATE ... SET extraction_status='failed'
   - console.warn(...)
```

**Image-capable types**: `image/jpeg`, `image/png`, `image/gif`, `image/webp`, `image/tiff`, `image/bmp` plus `application/pdf` (PDF with no text layer may need OCR).

---

### T006 - Search module updates

**File**: `spine/src/search.ts`

1. Update `attachmentToMarkdown(data: AttachmentData, extractedText = '')`: append extracted text below frontmatter when non-empty.
2. Update `workingAttachmentToMarkdown(data: WorkingAttachmentData, extractedText = '')`: same.
3. Update `writeAttachmentIndex(id, capture_id, filename, content_type, size_bytes, created_at, extractedText = '')`: pass through to markdown function.
4. Update `writeWorkingAttachmentIndex(...)`: same.
5. Update `initSearch()`: when rebuilding attachment index files, read `extracted_text` from DB rows and pass to markdown functions. Also read `attachment_descriptions` to get `final_text` for `dark` attachments.

**initSearch change detail** (attachment rebuild loop):
```typescript
const attachmentRows = db.query(`
  SELECT ca.id, ca.capture_id, ca.filename, ca.content_type, ca.size_bytes, ca.created_at,
         ca.extraction_status, ca.extracted_text,
         ad.final_text as description_text
  FROM capture_attachments ca
  LEFT JOIN attachment_descriptions ad ON (
    ad.attachment_kind = 'capture' AND ad.attachment_id = ca.id AND ad.supersedes IS NULL
  )
`).all();

for (const row of attachmentRows) {
  const filePath = join(attachmentsMd, `${row.id}.md`);
  if (!existsSync(filePath)) {
    const text = row.extraction_status === 'dark'
      ? (row.description_text ?? '')
      : row.extracted_text;
    writeFileSync(filePath, attachmentToMarkdown(row, text));
  }
}
```

---

### T007 - Route changes: set pending on upload and expose status

**Files**: `spine/src/routes/attachments.ts`, `spine/src/routes/working.ts`

1. In `attachments.ts` POST handler: change `INSERT INTO capture_attachments` to include `extraction_status, extracted_text` columns with values `'pending'` and `''`.
2. Queue extraction after writing the index file: `queueAttachment(row.id, 'capture', fullStoredPath, contentType, db)`.
3. Add `extraction_status` to the upload response object.
4. In GET list query: add `extraction_status` to the SELECT columns.
5. Repeat for `working.ts`.

---

### T008 - New description routes

**Files**: `spine/src/routes/attachments.ts`, `spine/src/routes/working.ts`

Add to each file:

```typescript
// GET /api/captures/:id/attachments/:attId/description
// Returns 200 with description, 404 if absent, 409 if not dark
.get('/api/captures/:id/attachments/:attId/description', ({ params, set }) => {
  // validate captureId, attId
  // query attachment row - check exists, belongs to capture
  // if extraction_status != 'dark': 409
  // query attachment_descriptions WHERE kind='capture' AND id=attId AND supersedes IS NULL
  // if none: 404
  // return row
})

// PATCH /api/captures/:id/attachments/:attId/description
// Updates final_text and/or confirmed
.patch('/api/captures/:id/attachments/:attId/description', async ({ params, body, set }) => {
  // validate, load attachment
  // validate body: at least one of final_text, confirmed; final_text not empty string
  // load current description row
  // update in-place (this is a user edit, not a system re-run)
  // if final_text changed: rewrite index file, refreshIndex()
  // return updated row
}, { body: t.Object({ final_text: t.Optional(t.String()), confirmed: t.Optional(t.Boolean()) }) })
```

Repeat for working-attachment description routes.

---

### T009 - Startup wiring

**File**: `spine/src/index.ts`

After `await initSearch(db)`:
```typescript
import { sweepPending } from './extraction-queue';
// ...
await initSearch(db);
await sweepPending(db, ATTACHMENTS_DIR);
```

Import `queueAttachment` for use in route handlers (passed through `buildApp`/`AppDeps` or imported directly).

---

### T010 - Tests

**Files**: `spine/tests/routes/attachment-extraction.test.ts`, `spine/tests/extract.test.ts`

**`extract.test.ts`**:
- Test `extractText` with a temp plain-text file → returns content
- Test subprocess invocation with a real tiny PDF (if `pdftotext` available; skip otherwise)
- Test truncation at 100k characters
- Test that a missing-tool ENOENT causes a throw (not a silent empty string)

**`attachment-extraction.test.ts`**:
- Upload attachment → response includes `extraction_status: 'pending'`
- GET list → items include `extraction_status`
- Description PATCH → updates `final_text`; GET returns updated value
- Description PATCH with `confirmed: true` → confirmed; subsequent re-run is a no-op
- GET description on non-dark attachment → 409
- GET description with no description yet → 404

**Note**: The queue processes asynchronously; route tests do not test the full extraction pipeline end-to-end (that would require real subprocess tools in CI). The queue module has unit tests for the state-machine logic with mocked extract/describe functions.

---

## Quickstart: Server Setup for Tier 1

See `quickstart.md` for configuration instructions. Summary:
- Tier 0 needs `pdftotext` and `pandoc` installed on the server.
- Tier 1 needs a vision-capable model at the inference endpoint plus `ocr_model`/`vlm_model` in `config.toml`.

---

## Sequence: Attachment upload with extraction

```
Client                spine                  extraction-queue
  │                     │                          │
  │─POST /attachments──►│                          │
  │                     │ INSERT (status=pending)  │
  │                     │ writeAttachmentIndex      │
  │                     │ queueAttachment() ───────►│ (appended to chain)
  │◄──{ id, status="pending" }──────────────────── │
  │                     │                          │ (async, after lock acquired)
  │                     │                          │ extractText()
  │                     │                          │ UPDATE status='done'
  │                     │                          │ writeAttachmentIndex(text)
  │                     │                          │ refreshIndex()
```

---

## Out of Scope

- Surface UI changes (extraction_status is available in API responses for future surface work)
- Re-extraction on demand endpoint (deferred; restart with reset is the current recovery path)
- Batch extraction retry UI
- Virus scanning
- Audio or video transcription
