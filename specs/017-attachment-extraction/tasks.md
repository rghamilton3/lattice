# Tasks: Attachment Extraction and Image Description

**Feature**: 017-attachment-extraction
**Branch**: `worktree-feat+attachment-exdtraction-and-image-description`
**Generated**: 2026-06-08
**Total tasks**: 12

<!-- Tech Stack Validation: PASSED -->
<!-- Validated against: .specswarm/tech-stack.md -->
<!-- No prohibited technologies found (TypeScript only; Bun.spawn for subprocesses; no new npm deps) -->

---

## Completion Tracker

- [ ] T001 Write DB migration 013 (extraction columns) — `spine/migrations/013_attachment_extraction.sql`
- [ ] T002 Write DB migration 014 (attachment_descriptions table) — `spine/migrations/014_attachment_descriptions.sql`
- [ ] T003 Add ExtractionStatus type and new row columns to DB types; add OCR/VLM config exports — `spine/src/db/rows.ts`, `spine/src/config.ts`
- [ ] T004 [P] Implement Tier 0 inline extraction (text/csv/md) in extract.ts — `spine/src/extract.ts`
- [ ] T005 [P] Implement Tier 0 subprocess extraction (PDF via pdftotext; DOCX/PPTX/XLSX via pandoc) in extract.ts — `spine/src/extract.ts`
- [ ] T006 Implement Tier 1 OCR (ocrImage) via inference endpoint in extract.ts — `spine/src/extract.ts`
- [ ] T007 Implement extraction queue module (queueAttachment, sweepPending, _queueLock chain) — `spine/src/extraction-queue.ts`
- [ ] T008 Extend search index functions to accept and write extracted text — `spine/src/search.ts`
- [ ] T009 Set extraction_status='pending' on upload; expose status in list/upload responses; wire queueAttachment — `spine/src/routes/attachments.ts`, `spine/src/routes/working.ts`
- [ ] T010 Wire sweepPending into startup before HTTP listen — `spine/src/index.ts`
- [ ] T011 [P] Implement generateDescription (VLM call + attachment_descriptions write) and description GET/PATCH routes — `spine/src/describe.ts`, `spine/src/routes/attachments.ts`, `spine/src/routes/working.ts`
- [ ] T012 [P] Write tests for extraction pipeline and description endpoints — `spine/tests/routes/attachment-extraction.test.ts`, `spine/tests/extract.test.ts`

---

## Phase 1: Foundational - DB Schema and Types

These tasks must complete before any other task. No application code can reference the new columns until the migrations and types exist.

### T001 - Write migration 013: extraction columns
- [ ] T001 Write DB migration 013 (extraction columns) — `spine/migrations/013_attachment_extraction.sql`

**File**: `spine/migrations/013_attachment_extraction.sql`

```sql
ALTER TABLE capture_attachments ADD COLUMN extraction_status TEXT NOT NULL DEFAULT 'pending';
ALTER TABLE capture_attachments ADD COLUMN extracted_text    TEXT NOT NULL DEFAULT '';

ALTER TABLE working_attachments ADD COLUMN extraction_status TEXT NOT NULL DEFAULT 'pending';
ALTER TABLE working_attachments ADD COLUMN extracted_text    TEXT NOT NULL DEFAULT '';
```

Write this file exactly. No other changes.

---

### T002 - Write migration 014: attachment_descriptions table
- [ ] T002 Write DB migration 014 (attachment_descriptions table) — `spine/migrations/014_attachment_descriptions.sql`

**File**: `spine/migrations/014_attachment_descriptions.sql`

```sql
CREATE TABLE attachment_descriptions (
  id              INTEGER PRIMARY KEY AUTOINCREMENT,
  attachment_kind TEXT    NOT NULL CHECK (attachment_kind IN ('capture', 'working')),
  attachment_id   INTEGER NOT NULL,
  produced_text   TEXT    NOT NULL,
  final_text      TEXT    NOT NULL,
  confirmed       INTEGER NOT NULL DEFAULT 0,
  model_id        TEXT    NOT NULL,
  supersedes      INTEGER REFERENCES attachment_descriptions(id),
  created_at      TEXT    NOT NULL
);
CREATE INDEX idx_att_desc_attachment ON attachment_descriptions(attachment_kind, attachment_id);
CREATE INDEX idx_att_desc_supersedes ON attachment_descriptions(supersedes)
  WHERE supersedes IS NOT NULL;
```

Write this file exactly. No other changes.

---

### T003 - DB row types and config additions
- [ ] T003 Add ExtractionStatus type and new row columns to DB types; add OCR/VLM config exports — `spine/src/db/rows.ts`, `spine/src/config.ts`

**`spine/src/db/rows.ts`** - add after the existing imports:
```typescript
export type ExtractionStatus = 'pending' | 'done' | 'failed' | 'dark';

export interface AttachmentDescriptionRow {
    id: number;
    attachment_kind: 'capture' | 'working';
    attachment_id: number;
    produced_text: string;
    final_text: string;
    confirmed: number;
    model_id: string;
    supersedes: number | null;
    created_at: string;
}
```

Add `extraction_status: ExtractionStatus` and `extracted_text: string` to both `CaptureAttachmentRow` and `WorkingAttachmentRow`.

**`spine/src/config.ts`** - add `ocr_model?: string` and `vlm_model?: string` to `QmdModelsConfig`. Add two new exported functions:
```typescript
export function getOcrModel(): string | undefined {
    return readLatticeConfig().spine?.qmd?.ocr_model;
}
export function getVlmModel(): string | undefined {
    return readLatticeConfig().spine?.qmd?.vlm_model;
}
```

Also export `getQmdBaseUrl()` that returns `readLatticeConfig().spine?.qmd?.embed_api_url` - needed by T004/T006 for inference calls. (Check if this already exists before adding.)

---

## Phase 2: User Stories 1 and 2 - Extraction Pipeline

US1 (searchable document attachments) and US2 (consistent extraction status) are co-implemented. The extraction pipeline is the backbone of both.

**Independent test for US1+US2**: Upload a plain-text attachment. Confirm `extraction_status` transitions from `pending` to `done` and the filename+content appears in the QMD index.

### T004 - extract.ts: Tier 0 inline
- [ ] T004 [P] Implement Tier 0 inline extraction (text/csv/md) in extract.ts — `spine/src/extract.ts`

**File**: `spine/src/extract.ts` (create new)

Create the file with:
```typescript
import { readFileSync } from 'node:fs';
import { getOcrModel, getQmdBaseUrl } from './config';

const INLINE_TYPES = new Set([
    'text/plain', 'text/csv', 'text/markdown', 'text/x-markdown',
    'application/csv', 'text/tab-separated-values',
]);

const MAX_TEXT_CHARS = 100_000;

function truncate(text: string): string {
    if (text.length <= MAX_TEXT_CHARS) return text;
    const cut = text.lastIndexOf(' ', MAX_TEXT_CHARS);
    return text.slice(0, cut > 0 ? cut : MAX_TEXT_CHARS);
}

export function extractInline(storedFullPath: string): string {
    return truncate(readFileSync(storedFullPath, 'utf-8'));
}

export function isInlineType(contentType: string): boolean {
    return INLINE_TYPES.has(contentType.split(';')[0].trim().toLowerCase());
}
```

T005 will add subprocess extraction to this file. T006 will add OCR. Do not implement those here.

---

### T005 - extract.ts: Tier 0 subprocess
- [ ] T005 [P] Implement Tier 0 subprocess extraction (PDF via pdftotext; DOCX/PPTX/XLSX via pandoc) in extract.ts — `spine/src/extract.ts`

**File**: `spine/src/extract.ts` (extend T004's file)

Add to `extract.ts`:

```typescript
const SUBPROCESS_TYPES: Record<string, { cmd: string; args: (path: string) => string[] }> = {
    'application/pdf': { cmd: 'pdftotext', args: (p) => [p, '-'] },
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document':
        { cmd: 'pandoc', args: (p) => ['--from=docx', '--to=plain', p] },
    'application/vnd.openxmlformats-officedocument.presentationml.presentation':
        { cmd: 'pandoc', args: (p) => ['--from=pptx', '--to=plain', p] },
    'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet':
        { cmd: 'pandoc', args: (p) => ['--from=xlsx', '--to=plain', p] },
    'application/msword':
        { cmd: 'pandoc', args: (p) => ['--from=doc', '--to=plain', p] },
};

export function isSubprocessType(contentType: string): boolean {
    return contentType.split(';')[0].trim().toLowerCase() in SUBPROCESS_TYPES;
}

export async function extractSubprocess(storedFullPath: string, contentType: string): Promise<string> {
    const norm = contentType.split(';')[0].trim().toLowerCase();
    const spec = SUBPROCESS_TYPES[norm];
    if (!spec) throw new Error(`No subprocess handler for ${contentType}`);

    const proc = Bun.spawn([spec.cmd, ...spec.args(storedFullPath)], {
        stdout: 'pipe',
        stderr: 'pipe',
    });
    const [stdout, exitCode] = await Promise.all([
        new Response(proc.stdout).text(),
        proc.exited,
    ]);
    if (exitCode !== 0) {
        const stderr = await new Response(proc.stderr).text();
        throw new Error(`${spec.cmd} exited ${exitCode}: ${stderr.slice(0, 200)}`);
    }
    return truncate(stdout);
}
```

`truncate` is defined in T004's portion of the same file; use it directly.

---

### T006 - extract.ts: Tier 1 OCR via inference endpoint
- [ ] T006 Implement Tier 1 OCR (ocrImage) via inference endpoint in extract.ts — `spine/src/extract.ts`

**File**: `spine/src/extract.ts` (extend T004+T005 file)

Add:
```typescript
const IMAGE_TYPES = new Set([
    'image/jpeg', 'image/png', 'image/gif', 'image/webp',
    'image/tiff', 'image/bmp', 'image/avif',
]);

export function isImageType(contentType: string): boolean {
    return IMAGE_TYPES.has(contentType.split(';')[0].trim().toLowerCase());
}

export async function ocrImage(storedFullPath: string, contentType: string): Promise<string> {
    const model = getOcrModel();
    if (!model) return '';

    const baseUrl = getQmdBaseUrl();
    if (!baseUrl) return '';

    const bytes = readFileSync(storedFullPath);
    const b64 = bytes.toString('base64');
    const mime = contentType.split(';')[0].trim();

    const resp = await fetch(`${baseUrl}/chat/completions`, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            ...(process.env.QMD_EMBED_API_KEY ? { Authorization: `Bearer ${process.env.QMD_EMBED_API_KEY}` } : {}),
        },
        body: JSON.stringify({
            model,
            messages: [{
                role: 'user',
                content: [
                    { type: 'image_url', image_url: { url: `data:${mime};base64,${b64}` } },
                    { type: 'text', text: 'Extract all text from this image exactly as it appears. Return only the extracted text with no commentary. If there is no text, return an empty response.' },
                ],
            }],
            max_tokens: 2000,
        }),
    });

    if (!resp.ok) throw new Error(`OCR inference ${resp.status}: ${await resp.text()}`);
    const json = await resp.json() as { choices: Array<{ message: { content: string } }> };
    return truncate((json.choices[0]?.message?.content ?? '').trim());
}
```

Also add a top-level `extractText` export that orchestrates Tier 0 + Tier 1 given a stored path and content type:
```typescript
export async function extractText(
    storedFullPath: string,
    contentType: string,
): Promise<{ text: string; tier: 0 | 1 }> {
    const norm = contentType.split(';')[0].trim().toLowerCase();
    if (isInlineType(norm)) {
        return { text: extractInline(storedFullPath), tier: 0 };
    }
    if (isSubprocessType(norm)) {
        const text = await extractSubprocess(storedFullPath, norm);
        return { text, tier: 0 };
    }
    if (isImageType(norm)) {
        const text = await ocrImage(storedFullPath, norm);
        return { text, tier: 1 };
    }
    // PDF with no explicit handler above falls through to OCR
    if (norm === 'application/pdf') {
        // pdftotext already covered by subprocess; this branch handles PDF that subprocess returned empty
        // (no-op here; queue logic handles empty-subprocess-result case separately)
    }
    return { text: '', tier: 0 };
}
```

---

### T007 - extraction-queue.ts
- [ ] T007 Implement extraction queue module (queueAttachment, sweepPending, _queueLock chain) — `spine/src/extraction-queue.ts`

**File**: `spine/src/extraction-queue.ts` (create new)

Implement:
```typescript
import type { Database } from 'bun:sqlite';
import { join } from 'node:path';
import { existsSync } from 'node:fs';
import { extractText, isImageType } from './extract';
import { generateDescription } from './describe';
import { writeAttachmentIndex, writeWorkingAttachmentIndex, refreshIndex } from './search';

let _queueLock: Promise<void> = Promise.resolve();

export function queueAttachment(
    id: number,
    kind: 'capture' | 'working',
    storedFullPath: string,
    contentType: string,
    db: Database,
): void {
    _queueLock = _queueLock.then(() => processOne(id, kind, storedFullPath, contentType, db)).catch(() => {});
}

export async function sweepPending(db: Database, attachmentsDir: string): Promise<void> {
    const captureRows = db.query(
        `SELECT id, capture_id, filename, content_type, size_bytes, stored_path, created_at
         FROM capture_attachments WHERE extraction_status = 'pending'`
    ).all() as Array<{ id: number; capture_id: number; filename: string; content_type: string; size_bytes: number; stored_path: string; created_at: string }>;

    const workingRows = db.query(
        `SELECT id, slug, filename, content_type, size_bytes, stored_path, created_at
         FROM working_attachments WHERE extraction_status = 'pending'`
    ).all() as Array<{ id: number; slug: string; filename: string; content_type: string; size_bytes: number; stored_path: string; created_at: string }>;

    for (const row of captureRows) {
        const fullPath = join(attachmentsDir, row.stored_path);
        queueAttachment(row.id, 'capture', fullPath, row.content_type, db);
    }
    for (const row of workingRows) {
        const fullPath = join(attachmentsDir, row.stored_path);
        queueAttachment(row.id, 'working', fullPath, row.content_type, db);
    }

    // Wait for all enqueued work to drain before returning (startup guarantee)
    await _queueLock;
}
```

Implement `processOne(id, kind, storedFullPath, contentType, db)`:
1. If file does not exist on disk: set status `failed`, return.
2. Try `extractText(storedFullPath, contentType)`.
3. If `text` non-empty: set status `done`, store `extracted_text`, update index file, call `refreshIndex()`.
4. If `text` empty AND `isImageType(contentType)` AND result `tier === 0` (i.e. subprocess returned empty): try `ocrImage(storedFullPath, contentType)` directly.
   - If OCR produces text: set `done`, store text, update index, refresh.
   - If OCR empty or `ocrImage` throws: go to dark path.
5. Dark path: set status `dark`, call `generateDescription(id, kind, storedFullPath, db)`.
6. On any unhandled error from steps 2-5: set status `failed`, `console.warn`.

For index writes: call the appropriate `writeAttachmentIndex` / `writeWorkingAttachmentIndex` with the extracted text. These will need to read the existing row metadata from DB (filename, content_type, size_bytes, created_at, capture_id/slug) - query DB inline.

---

### T008 - search.ts: extend markdown functions with extracted text
- [ ] T008 Extend search index functions to accept and write extracted text — `spine/src/search.ts`

**File**: `spine/src/search.ts`

1. Update `attachmentToMarkdown` signature:
   ```typescript
   export function attachmentToMarkdown(data: AttachmentData, extractedText = ''): string {
       const body = extractedText ? `${sanitize(data.filename)}\n\n${extractedText}` : sanitize(data.filename);
       return `---\nid: ${data.id}\ncapture_id: ${data.capture_id}\nfilename: ${sanitize(data.filename)}\ncontent_type: ${sanitize(data.content_type)}\nsize_bytes: ${data.size_bytes}\ncreated_at: ${sanitize(data.created_at)}\n---\n\n${body}\n`;
   }
   ```

2. Same for `workingAttachmentToMarkdown`.

3. Update `writeAttachmentIndex` to accept and pass through `extractedText = ''`.

4. Update `writeWorkingAttachmentIndex` to accept and pass through `extractedText = ''`.

5. Update the `initSearch` attachment rebuild loop to read `extracted_text` and `description_text` from DB:
   - Query `capture_attachments` LEFT JOIN `attachment_descriptions` (where `kind='capture'` and `supersedes IS NULL`)
   - For each row: use `description_text` when `extraction_status = 'dark'`, else use `extracted_text`
   - Pass the resolved text to `attachmentToMarkdown`
   - Do the same for `working_attachments`

---

### T009 - Route changes: set pending on upload; expose status in responses
- [ ] T009 Set extraction_status='pending' on upload; expose status in list/upload responses; wire queueAttachment — `spine/src/routes/attachments.ts`, `spine/src/routes/working.ts`

**`spine/src/routes/attachments.ts`**:

1. Import `queueAttachment` from `../extraction-queue`.

2. In the POST `/api/captures/:id/attachments` handler, change the INSERT to include the new columns:
   ```sql
   INSERT INTO capture_attachments
     (capture_id, signal_id, content_type, filename, size_bytes, stored_path, upload_source, created_at,
      extraction_status, extracted_text)
   VALUES (?, '', ?, ?, ?, '', ?, 'pending', '') RETURNING id
   ```

3. After `writeAttachmentIndex` and `refreshIndex()`, add:
   ```typescript
   queueAttachment(row.id, 'capture', join(attachmentsDir, storedPath), contentType, db);
   ```

4. Add `extraction_status: 'pending'` to the upload response object.

5. In the GET list query, add `extraction_status` to the SELECT columns. The response items already return the full row; make sure `extraction_status` is included.

6. Inject `db` into the route factory's scope so `queueAttachment` can receive it. (`db` is already available as a closure variable in `attachmentRoutes`.)

**`spine/src/routes/working.ts`** - identical changes for working attachments:
- POST INSERT adds `extraction_status = 'pending'`, `extracted_text = ''`
- After index write, call `queueAttachment(row.id, 'working', ..., db)`
- Upload response includes `extraction_status: 'pending'`
- GET list SELECT adds `extraction_status`

---

### T010 - Startup wiring
- [ ] T010 Wire sweepPending into startup before HTTP listen — `spine/src/index.ts`

**File**: `spine/src/index.ts`

Add import:
```typescript
import { sweepPending } from './extraction-queue';
```

After `await initSearch(db)`, add:
```typescript
await sweepPending(db, ATTACHMENTS_DIR);
```

The `sweepPending` call awaits the entire queue drain (all pending attachments processed) before the `.listen()` call runs, satisfying FR-002.

---

## Phase 3: User Story 3 - Image Descriptions

US3 depends on the extraction pipeline from Phase 2 being complete (`dark` status set before description generation can run). T011 can be worked in parallel with Phase 2 tasks because `describe.ts` is a standalone module.

**Independent test for US3**: Upload an image with no text content. Confirm `extraction_status = 'dark'` after processing, and a description row exists in `attachment_descriptions`. Edit `final_text` via the PATCH endpoint; confirm GET returns updated text.

### T011 - describe.ts and description routes
- [ ] T011 [P] Implement generateDescription (VLM call + attachment_descriptions write) and description GET/PATCH routes — `spine/src/describe.ts`, `spine/src/routes/attachments.ts`, `spine/src/routes/working.ts`

**`spine/src/describe.ts`** (create new):

```typescript
import type { Database } from 'bun:sqlite';
import { readFileSync } from 'node:fs';
import { getVlmModel, getQmdBaseUrl } from './config';
import type { AttachmentDescriptionRow } from './db/rows';
import { writeAttachmentIndex, writeWorkingAttachmentIndex, attachmentsMdDir, workingAttachmentsMdDir, refreshIndex } from './search';
import { join } from 'node:path';

export async function generateDescription(
    attachmentId: number,
    kind: 'capture' | 'working',
    storedFullPath: string,
    db: Database,
): Promise<void> {
    const model = getVlmModel();
    if (!model) return;

    const baseUrl = getQmdBaseUrl();
    if (!baseUrl) return;

    // If confirmed description exists, skip
    const existing = db.query(
        `SELECT id, confirmed FROM attachment_descriptions
         WHERE attachment_kind = ? AND attachment_id = ? AND supersedes IS NULL`
    ).get(kind, attachmentId) as { id: number; confirmed: number } | null;

    if (existing?.confirmed) return;

    const bytes = readFileSync(storedFullPath);
    const b64 = bytes.toString('base64');
    const mimeRow = db.query(
        `SELECT content_type FROM ${kind === 'capture' ? 'capture_attachments' : 'working_attachments'} WHERE id = ?`
    ).get(attachmentId) as { content_type: string } | null;
    const mime = mimeRow?.content_type ?? 'image/jpeg';

    const resp = await fetch(`${baseUrl}/chat/completions`, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            ...(process.env.QMD_EMBED_API_KEY ? { Authorization: `Bearer ${process.env.QMD_EMBED_API_KEY}` } : {}),
        },
        body: JSON.stringify({
            model,
            messages: [{
                role: 'user',
                content: [
                    { type: 'image_url', image_url: { url: `data:${mime};base64,${b64}` } },
                    { type: 'text', text: 'Describe this image in 2-3 sentences. Focus on what is shown: objects, diagrams, text style, or visual content. Be concise and factual.' },
                ],
            }],
            max_tokens: 500,
        }),
    });

    if (!resp.ok) throw new Error(`VLM inference ${resp.status}`);
    const json = await resp.json() as { choices: Array<{ message: { content: string } }> };
    const text = (json.choices[0]?.message?.content ?? '').trim();
    if (!text) return;

    const now = new Date().toISOString();
    db.transaction(() => {
        const newRow = db.prepare(
            `INSERT INTO attachment_descriptions
               (attachment_kind, attachment_id, produced_text, final_text, confirmed, model_id, supersedes, created_at)
             VALUES (?, ?, ?, ?, 0, ?, ?, ?) RETURNING id`
        ).get(kind, attachmentId, text, text, model, existing?.id ?? null, now) as { id: number };

        // Update the QMD index file with the description text
        // (read metadata from DB to reconstruct the markdown)
        if (kind === 'capture') {
            const row = db.query(
                'SELECT id, capture_id, filename, content_type, size_bytes, created_at FROM capture_attachments WHERE id = ?'
            ).get(attachmentId) as { id: number; capture_id: number; filename: string; content_type: string; size_bytes: number; created_at: string };
            if (row) writeAttachmentIndex(row.id, row.capture_id, row.filename, row.content_type, row.size_bytes, row.created_at, text);
        } else {
            const row = db.query(
                'SELECT id, slug, filename, content_type, size_bytes, created_at FROM working_attachments WHERE id = ?'
            ).get(attachmentId) as { id: number; slug: string; filename: string; content_type: string; size_bytes: number; created_at: string };
            if (row) writeWorkingAttachmentIndex(row.id, row.slug, row.filename, row.content_type, row.size_bytes, row.created_at, text);
        }
    })();

    refreshIndex();
}
```

**Description routes** - add to `spine/src/routes/attachments.ts`:

```typescript
// GET /api/captures/:id/attachments/:attId/description
.get('/api/captures/:id/attachments/:attId/description',
    ({ params, set }) => {
        const captureId = parseInt(params.id, 10);
        const attId = parseInt(params.attId, 10);
        if (isNaN(captureId) || isNaN(attId)) { set.status = 400; return { error: 'Invalid id' }; }

        const att = db.query('SELECT extraction_status FROM capture_attachments WHERE id = ? AND capture_id = ?')
            .get(attId, captureId) as { extraction_status: string } | null;
        if (!att) { set.status = 404; return { error: 'Not found' }; }
        if (att.extraction_status !== 'dark') { set.status = 409; return { error: 'Attachment is not dark' }; }

        const desc = db.query(
            `SELECT * FROM attachment_descriptions
             WHERE attachment_kind = 'capture' AND attachment_id = ? AND supersedes IS NULL`
        ).get(attId) as AttachmentDescriptionRow | null;
        if (!desc) { set.status = 404; return { error: 'No description yet' }; }
        return { ...desc, confirmed: desc.confirmed === 1 };
    },
    { params: t.Object({ id: t.String(), attId: t.String() }) }
)

// PATCH /api/captures/:id/attachments/:attId/description
.patch('/api/captures/:id/attachments/:attId/description',
    ({ params, body, set }) => {
        const captureId = parseInt(params.id, 10);
        const attId = parseInt(params.attId, 10);
        if (isNaN(captureId) || isNaN(attId)) { set.status = 400; return { error: 'Invalid id' }; }

        const { final_text, confirmed } = body as { final_text?: string; confirmed?: boolean };
        if (final_text === undefined && confirmed === undefined) { set.status = 400; return { error: 'Nothing to update' }; }
        if (final_text !== undefined && final_text.trim() === '') { set.status = 400; return { error: 'final_text cannot be empty' }; }

        const att = db.query('SELECT extraction_status FROM capture_attachments WHERE id = ? AND capture_id = ?')
            .get(attId, captureId) as { extraction_status: string } | null;
        if (!att) { set.status = 404; return { error: 'Not found' }; }

        const desc = db.query(
            `SELECT * FROM attachment_descriptions
             WHERE attachment_kind = 'capture' AND attachment_id = ? AND supersedes IS NULL`
        ).get(attId) as AttachmentDescriptionRow | null;
        if (!desc) { set.status = 404; return { error: 'No description' }; }

        const updates: string[] = [];
        const vals: unknown[] = [];
        if (final_text !== undefined) { updates.push('final_text = ?'); vals.push(final_text); }
        if (confirmed !== undefined) { updates.push('confirmed = ?'); vals.push(confirmed ? 1 : 0); }
        vals.push(desc.id);
        db.prepare(`UPDATE attachment_descriptions SET ${updates.join(', ')} WHERE id = ?`).run(...vals);

        if (final_text !== undefined) {
            const row = db.query('SELECT id, capture_id, filename, content_type, size_bytes, created_at FROM capture_attachments WHERE id = ?')
                .get(attId) as { id: number; capture_id: number; filename: string; content_type: string; size_bytes: number; created_at: string };
            if (row) { writeAttachmentIndex(row.id, row.capture_id, row.filename, row.content_type, row.size_bytes, row.created_at, final_text); refreshIndex(); }
        }

        const updated = db.query('SELECT * FROM attachment_descriptions WHERE id = ?').get(desc.id) as AttachmentDescriptionRow;
        return { ...updated, confirmed: updated.confirmed === 1 };
    },
    { params: t.Object({ id: t.String(), attId: t.String() }),
      body: t.Object({ final_text: t.Optional(t.String()), confirmed: t.Optional(t.Boolean()) }) }
)
```

Add identical routes to `spine/src/routes/working.ts` substituting `capture_id`/`slug` checks and `kind = 'working'`.

---

## Phase 4: Tests

### T012 - Tests for extraction pipeline and description endpoints
- [ ] T012 [P] Write tests for extraction pipeline and description endpoints — `spine/tests/routes/attachment-extraction.test.ts`, `spine/tests/extract.test.ts`

**`spine/tests/extract.test.ts`**:
- Test `extractInline` with a temp plain-text file → returns exact content
- Test `extractInline` with content > 100k chars → truncated at word boundary
- Test `isInlineType('text/plain')` → true; `isInlineType('application/pdf')` → false
- Test `isImageType('image/jpeg')` → true; `isImageType('text/plain')` → false
- Test `isSubprocessType('application/pdf')` → true
- Test `ocrImage` with no `ocr_model` configured → returns empty string (no network call)
- Test `extractSubprocess` with a non-existent binary → throws (tool-not-found path)

**`spine/tests/routes/attachment-extraction.test.ts`**:

Setup: use existing test DB pattern from `spine/tests/routes/attachments.test.ts`. Upload a text file to a capture, assert response includes `extraction_status: 'pending'`. GET list, assert `extraction_status` present on items.

Description endpoints (no real VLM needed - set status manually):
```typescript
// Manually set a capture attachment to dark + insert a description row
db.run(`UPDATE capture_attachments SET extraction_status = 'dark' WHERE id = ?`, [attId]);
db.run(`INSERT INTO attachment_descriptions ... VALUES ('capture', ?, ..., 0, 'test-model', null, ?)`, [attId, now]);

// GET description → 200 with row
// PATCH final_text → 200; GET returns updated text
// PATCH confirmed=true → 200
// GET non-dark attachment /description → 409
// GET attachment with no description → 404
```

Working attachment: mirror the same tests for a working-document attachment upload.

---

## Dependencies

```
T001 ──► T003 ──► T004, T005, T006 (can run in parallel once T003 is done)
T002 ──► T011 (attachment_descriptions table needed for describe.ts)
T004 + T005 + T006 ──► T007 (extraction queue imports from extract.ts)
T007 + T008 ──► T009 (routes import queue; search functions updated)
T009 ──► T010 (startup wiring; index.ts imports sweepPending)
T002 ──► T011 (can start once T002+T003 done; no dependency on T007-T009)
T001..T011 ──► T012 (tests run last)
```

**Parallelizable once foundations are done**:
- T004 and T005 can be worked simultaneously (different functions in extract.ts, no conflict if written to the same file sequentially)
- T011 and T007-T009 can be worked in parallel (describe.ts is a standalone module)
- T012 runs in parallel with any remaining polish

---

## MVP Scope

**US1 + US2 only** (Tier 0 extraction, status tracking, no inference required):
T001, T002, T003, T004, T005, T007, T008, T009, T010, T012

This delivers searchable text/PDF/Office documents without needing the inference endpoint. US3 (image descriptions via VLM) and Tier 1 OCR are additive once the MVP is working.
