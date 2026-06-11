# Data Model: Tasks Full CRUD

**Modification**: 006-mod-001

## Schema Changes

**None.** No migrations are required. The `captures` table already contains all columns needed for text editing and deletion.

The existing `captures` schema (relevant columns):

```sql
id               INTEGER PRIMARY KEY AUTOINCREMENT
text             TEXT    NOT NULL          -- editable via extended PATCH
source           TEXT    NOT NULL
captured_at      TEXT    NOT NULL
ingested_at      TEXT
triaged_at       TEXT
triage_action    TEXT                      -- 'task' for all task rows
task_due_date    TEXT
task_priority    TEXT
task_notes       TEXT
task_completed_at TEXT
```

The `capture_attachments` table is referenced during deletion only (no schema changes):

```sql
id           INTEGER PRIMARY KEY AUTOINCREMENT
capture_id   INTEGER NOT NULL REFERENCES captures(id)
stored_path  TEXT    NOT NULL
-- (other columns omitted for brevity)
```

## File System Changes

### On task delete

Files removed:
- `capturesDir()/${id}.md` - the capture's search-index markdown file
- `attachmentsDir/${att.stored_path}` - binary file for each `capture_attachments` row
- `attachmentsMdDir()/${att.id}.md` - index markdown for each `capture_attachments` row

### On task text update

Files rewritten:
- `capturesDir()/${id}.md` - overwritten via `writeCaptureFile(id, newText, 'task', captured_at)`
