# Data Model: Resurfacing & Clustering (018)

## New Tables (spine/migrations/)

### surfaced (015_surfaced.sql)

Append-only log of items selected by the nightly resurfacing pass. Never pruned.

```sql
CREATE TABLE surfaced (
  id           INTEGER PRIMARY KEY AUTOINCREMENT,
  target_kind  TEXT NOT NULL,            -- 'capture' | 'working' | 'local-file'
  target_id    TEXT NOT NULL,            -- capture id (string), working slug, or file path
  surfaced_at  TEXT NOT NULL,            -- ISO 8601 timestamp (when the pass ran)
  reason       TEXT,                     -- human-readable phrase (nullable)
  dismissed_at TEXT                      -- NULL until user dismisses; ISO 8601 when set
);
CREATE INDEX idx_surfaced_date      ON surfaced(surfaced_at);
CREATE INDEX idx_surfaced_dismissed ON surfaced(dismissed_at);
```

### clusters (016_clusters.sql)

One row per clustering run. Atomically replaced on each pass.

```sql
CREATE TABLE clusters (
  id     INTEGER PRIMARY KEY AUTOINCREMENT,
  run_at TEXT NOT NULL,   -- ISO 8601 timestamp of the clustering run
  label  TEXT             -- NULL for now; future: LLM-generated cluster name
);
```

### cluster_memberships (016_clusters.sql)

Associates each embedded document with a cluster. Replaced atomically with clusters.

```sql
CREATE TABLE cluster_memberships (
  cluster_id  INTEGER NOT NULL REFERENCES clusters(id) ON DELETE CASCADE,
  target_kind TEXT NOT NULL,   -- 'capture' | 'working' | 'local-file'
  target_id   TEXT NOT NULL,   -- same vocabulary as surfaced.target_id
  PRIMARY KEY (cluster_id, target_kind, target_id)
);
CREATE INDEX idx_cluster_memberships_doc
  ON cluster_memberships(target_kind, target_id);
```

## Existing Tables Referenced

### captures
- `id INTEGER` — maps to `target_id` (as string) when `target_kind = 'capture'`
- `text TEXT` — source of snippet and title
- `ingested_at TEXT` — proxy for "creation date" in recency heuristic

### file_index
- `id INTEGER`
- `path TEXT` — maps to `target_id` when `target_kind = 'local-file'`
- `text TEXT` — source of snippet
- `modified_at TEXT` — proxy for "creation date" in recency heuristic

### working docs (filesystem-only, no table)
- `slug` — maps to `target_id` when `target_kind = 'working'`
- `modified_at` — from `statSync(join(workingDir(), slug + '.md')).mtime`
- Content read from `{workingDir()}/{slug}.md`

## QMD Database (lattice.qmd.db, read-only from clustering code)

### documents
- `id INTEGER`, `collection TEXT`, `path TEXT`, `hash TEXT`, `active INTEGER`
- Collections used: `captures`, `working`, `local-files`

### content_vectors
- `hash TEXT`, `seq INTEGER`, `model TEXT`, `embed_fingerprint TEXT`

### vectors_vec (vec0 virtual table)
- `hash_seq TEXT` — `hash || '_' || seq`
- `embedding float[768]` — raw float32 blob, 3072 bytes

**Access requires:** `store.internal.db` (sqlite-vec extension already loaded by QMD init).

## target_kind / target_id Vocabulary

| target_kind | target_id | Lattice type | Link to source |
|-------------|-----------|-------------|----------------|
| `capture`   | `"123"` (numeric string) | Capture inbox item | `captures.id = parseInt(target_id)` |
| `working`   | `"my-slug"` | Working doc | `slug.md` under `workingDir()` |
| `local-file`| relative path e.g. `"machine1/docs/notes.md"` | Indexed local file | `file_index.path` |

## State Transitions

### surfaced row lifecycle
```
[CREATED by nightly pass]
    → dismissed_at = NULL (visible in panel)
    → dismissed_at = timestamp (hidden from panel; permanent in log)
```

### cluster lifecycle
```
[pass runs] → DELETE all existing clusters + memberships (CASCADE)
           → INSERT new clusters rows
           → INSERT new cluster_memberships rows
```
Cluster IDs are ephemeral: every pass replaces all rows. The `surfaced` rows are NOT linked
to cluster IDs (they use the same `target_kind`/`target_id` vocabulary, not foreign keys),
so replacing clusters does not affect the resurfaced panel.
