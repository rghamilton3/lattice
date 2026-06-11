# Data Model: Attachment Extraction and Image Description

**Feature**: 017-attachment-extraction
**Date**: 2026-06-08

---

## Schema Changes

### Migration 013: Add extraction columns to attachment tables

```sql
-- spine/migrations/013_attachment_extraction.sql

ALTER TABLE capture_attachments ADD COLUMN extraction_status TEXT NOT NULL DEFAULT 'pending';
ALTER TABLE capture_attachments ADD COLUMN extracted_text    TEXT NOT NULL DEFAULT '';

ALTER TABLE working_attachments ADD COLUMN extraction_status TEXT NOT NULL DEFAULT 'pending';
ALTER TABLE working_attachments ADD COLUMN extracted_text    TEXT NOT NULL DEFAULT '';
```

**Notes**:
- `DEFAULT 'pending'` on existing rows: any attachment uploaded before this migration is correctly treated as needing extraction.
- `extracted_text` stores the raw text from Tier 0 or Tier 1 OCR. Empty string means no text extracted yet (or none found).
- `extraction_status` valid values: `'pending'` | `'done'` | `'failed'` | `'dark'`
  - `pending` - not yet processed
  - `done` - text extracted and indexed (extracted_text non-empty)
  - `failed` - extraction attempted but subprocess or inference call errored
  - `dark` - extracted text is empty; a description was (or will be) generated
- No DB-level CHECK constraint on status to avoid blocking future status additions in tests. Application code enforces the four-value enum.

---

### Migration 014: attachment_descriptions table

```sql
-- spine/migrations/014_attachment_descriptions.sql

CREATE TABLE attachment_descriptions (
  id              INTEGER PRIMARY KEY AUTOINCREMENT,
  attachment_kind TEXT    NOT NULL CHECK (attachment_kind IN ('capture', 'working')),
  attachment_id   INTEGER NOT NULL,
  produced_text   TEXT    NOT NULL,
  final_text      TEXT    NOT NULL,
  confirmed       INTEGER NOT NULL DEFAULT 0,  -- SQLite boolean: 0 false, 1 true
  model_id        TEXT    NOT NULL,
  supersedes      INTEGER REFERENCES attachment_descriptions(id),
  created_at      TEXT    NOT NULL
);

CREATE INDEX idx_att_desc_attachment ON attachment_descriptions(attachment_kind, attachment_id);
CREATE INDEX idx_att_desc_supersedes ON attachment_descriptions(supersedes)
  WHERE supersedes IS NOT NULL;
```

**Field notes**:
- `produced_text` - verbatim model output; never modified after insert.
- `final_text` - starts equal to `produced_text`; updated by user PATCH; is what gets indexed.
- `confirmed` - once set to 1, automated re-runs MUST NOT overwrite this row.
- `supersedes` - nullable self-reference forming a singly-linked chain (head = NULL supersedes). A re-run creates a new row pointing at the old one; the old row is not deleted.
- The discriminated union `(attachment_kind, attachment_id)` mirrors the `(target_kind, target_id)` pattern in the `annotations` table.

---

## Updated TypeScript Row Types

### `spine/src/db/rows.ts` additions

```typescript
export type ExtractionStatus = 'pending' | 'done' | 'failed' | 'dark';

// Updated (add two columns)
export interface CaptureAttachmentRow {
    id: number;
    capture_id: number;
    signal_id: string;
    content_type: string;
    filename: string;
    size_bytes: number;
    stored_path: string;
    upload_source: string;
    created_at: string;
    extraction_status: ExtractionStatus;  // NEW
    extracted_text: string;               // NEW
}

// Updated (add two columns)
export interface WorkingAttachmentRow {
    id: number;
    slug: string;
    content_type: string;
    filename: string;
    size_bytes: number;
    stored_path: string;
    created_at: string;
    extraction_status: ExtractionStatus;  // NEW
    extracted_text: string;               // NEW
}

// New
export interface AttachmentDescriptionRow {
    id: number;
    attachment_kind: 'capture' | 'working';
    attachment_id: number;
    produced_text: string;
    final_text: string;
    confirmed: number;   // 0 | 1 (SQLite boolean)
    model_id: string;
    supersedes: number | null;
    created_at: string;
}
```

---

## State Transitions

```
[uploaded]
    │
    ▼
[pending] ──── Tier 0 text found ──────────────────► [done]
    │
    ├──── Tier 0 empty + image-capable ──► Tier 1 OCR ──── text found ─► [done]
    │                                                   │
    │                                                   └── no text ──► [dark] ──► description generated
    │
    ├──── Tier 0 subprocess error ──────────────────────────────────────► [failed]
    │
    └──── Tier 1 inference error ────────────────────────────────────────► stays [pending] (retried)
```

**dark → description**:
```
[dark]
  │
  ▼
attachment_descriptions row created:
  produced_text = model output
  final_text    = produced_text (initially)
  confirmed     = 0
  supersedes    = NULL
  │
  ▼
user PATCH final_text  ───► update final_text, reindex
user PATCH confirmed=1 ───► set confirmed=1; future re-runs skip this attachment
re-run (unconfirmed)   ───► new row with supersedes = old row id; old row unchanged
re-run (confirmed)     ───► no-op
```

---

## Config Model Changes

```typescript
// spine/src/config.ts — updated QmdModelsConfig
interface QmdModelsConfig {
    embed_api_url?: string;
    embed_api_model?: string;
    embed_api_key?: string;
    rerank_api_url?: string;
    rerank_api_model?: string;
    rerank_api_key?: string;
    expand_api_url?: string;
    expand_api_model?: string;
    expand_api_key?: string;
    // NEW: vision/OCR models for attachment extraction
    ocr_model?: string;   // if absent, Tier 1 OCR is skipped
    vlm_model?: string;   // if absent, dark-status description is skipped
}
```

**`config.toml` example additions**:
```toml
[spine.qmd]
embed_api_url   = "http://localhost:1234/v1"
embed_api_model = "nomic-embed-text"
ocr_model       = "minicpm-v"   # any vision-capable model
vlm_model       = "minicpm-v"
```
