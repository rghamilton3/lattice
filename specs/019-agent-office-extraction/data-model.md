# Data Model: Agent Office Extraction & Pattern Reconciliation

No spine-side schema changes. The agent's private cache database (`agent.db`, table
`file_cache`) gains two columns.

## file_cache (agent-local SQLite)

| Column | Type | Constraints | Notes |
|--------|------|-------------|-------|
| path | TEXT | PRIMARY KEY | existing |
| mtime_secs | INTEGER | NOT NULL | existing |
| size_bytes | INTEGER | NOT NULL | existing |
| hash | TEXT | NOT NULL | existing - blake3 hex |
| last_sent_at | TEXT | NOT NULL | existing - also stamps skip decisions |
| **outcome** | TEXT | NOT NULL DEFAULT 'indexed' | NEW: `'indexed'` \| `'skipped'` |
| **extractor_gen** | INTEGER | NOT NULL DEFAULT 0 | NEW: extractor-capability generation that produced this row |

### Migration

Applied idempotently at cache open (duplicate-column error ignored):

```sql
ALTER TABLE file_cache ADD COLUMN outcome TEXT NOT NULL DEFAULT 'indexed';
ALTER TABLE file_cache ADD COLUMN extractor_gen INTEGER NOT NULL DEFAULT 0;
```

Defaults are semantically correct for existing rows: every pre-existing cache row was a
successful index.

### State transitions

```
(no row) --extracted ok, spine accepted--> outcome='indexed', gen=CURRENT
(no row) --no extractor, not UTF-8------> outcome='skipped', gen=CURRENT  [warn once here]
outcome='skipped', gen < CURRENT --------> reprocessed on next scan (capability may have grown)
outcome='skipped', gen = CURRENT, file unchanged --> fast-path skip, no read, no warn
any row, file content changed -----------> reprocessed (existing mtime/size/hash logic)
```

`EXTRACTOR_GENERATION` is a source-level constant, set to `1` by this feature. It is bumped
whenever the set of extractable types changes.

## Index payload (agent → spine POST /api/agent/index)

Unchanged shape: `{ machine_id, path, hash, mime_type, text, modified_at, size_bytes }`.

Semantics refined:
- `mime_type` for Office files: the standard officedocument / msword MIME strings (same keys
  the spine uses in its own extraction table).
- `mime_type` for UTF-8 fallback files (e.g. `.org`): reported as `text/plain`, since the
  detected guess was demonstrably wrong and the indexed content is plain text.
- `text`: truncated to 100,000 characters at the last space (parity with spine spec 017).
