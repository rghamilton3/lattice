# Implementation Plan: Resurfacing & Clustering (018)

**Feature Branch**: `worktree-feat+resurface-and-clustering`
**Spec**: `specs/018-resurface-and-clustering/spec.md`
**Status**: Ready for implementation

---

## Tech Stack Compliance Report

### Approved Technologies (already in stack)

- **TypeScript 6** — all new spine and surface source
- **bun:sqlite** — direct SQLite access for reading QMD embedding vectors
- **Elysia 1.4** — new API routes follow existing pattern
- **@tobilu/qmd (vendored 2.5.3)** — `store.internal.db` exposes the underlying Database for vector reads
- **SvelteKit / Svelte 5 runes** — new components follow existing pattern
- **@tanstack/svelte-query** — resurfaced endpoint wrapped with `createQuery`
- **Tailwind CSS 4** — styling follows existing patterns

### New Dependencies

None. k-means is hand-rolled (~30 lines of TypeScript). No new packages required.

---

## Constitution Check

| Principle | Status | Notes |
|-----------|--------|-------|
| P1 — TypeScript for all new web source | Pass | All new files under spine/src and surface/src are .ts / .svelte |
| P2 — Normalize before QMD structuredSearch | Pass | Clustering reads raw vectors from `vectors_vec` directly; no `structuredSearch` call |
| P3 — Spine binds localhost only | Pass | New routes added to existing Elysia app, same binding |
| P4 — Capture is one motion | N/A | This feature is read-only; no capture UI |
| P5 — Tests accompany features | Required | Unit tests for k-means, resurfacing pass; integration tests for API routes |

---

## Technical Context

### Vector Access

QMD stores 768-dimensional float32 embeddings in `lattice.qmd.db` in a `vec0` virtual table
`vectors_vec(hash_seq TEXT PRIMARY KEY, embedding float[768])`. The public `QMDStore` exposes
`store.internal.db` which is the underlying `Database` with sqlite-vec already loaded.

**Access pattern:**
```typescript
import { getQmdStore } from './search';

const store = getQmdStore();            // returns QMDStore | null
const db = store?.internal.db;          // Database (bun:sqlite) with vec0 loaded
```

A new `getQmdStore()` export is added to `search.ts` (returns `_store`).

**Vector-to-document join:**
```sql
SELECT d.collection, d.path, v.embedding
FROM vectors_vec v
JOIN content_vectors cv
  ON cv.hash || '_' || cv.seq = v.hash_seq AND cv.seq = 0
JOIN documents d ON d.hash = cv.hash
WHERE d.active = 1
  AND d.collection IN ('captures', 'working', 'local-files')
```

Each blob comes back as a `Buffer` (bun:sqlite returns BLOBs as `Uint8Array`/`Buffer`).
Decode as `new Float32Array(buffer.buffer, buffer.byteOffset, buffer.byteLength / 4)`.

**Path → Lattice ID mapping:**
- `collection = 'captures'`, `path = '123.md'` → `target_kind = 'capture'`, `target_id = '123'`
- `collection = 'working'`, `path = 'my-slug.md'` → `target_kind = 'working'`, `target_id = 'my-slug'`
- `collection = 'local-files'`, `path = 'machine-id/encoded-path.md'` → `target_kind = 'local-file'`, `target_id = path`

### k-means Implementation

Hand-rolled in TypeScript. No external dependency. Algorithm:

1. Initialise k centroids using k-means++ seeding (random among actual points, then farthest-first)
2. Iterate up to 100 rounds: assign each point to nearest centroid (cosine distance), recompute centroids
3. Stop early if assignments don't change
4. k = clamp(Math.round(Math.sqrt(n)), 2, 20)

Cosine similarity over 768-dim vectors on 10–500 docs runs in <<1s in V8 (no WASM needed).

### Resurfacing Pass

Per-cluster selection order:
1. Members with no prior `surfaced` row at all (never surfaced)
2. Among those, oldest by `ingested_at` (captures) or `modified_at` (working / local-files)
3. Skip members with any `surfaced` row where `surfaced_at >= now - 7 days`

The pass is guarded by a date check: if a `surfaced` row exists with `surfaced_at` on today's
date (same UTC date) for any item in the cluster, that cluster is already done. This achieves
idempotency.

### Background Timer

Mirrors `startEmbeddingBackfill` / `stopEmbeddingBackfill` in `search.ts`. 24-hour interval
with ±2h jitter on first fire to spread load on server restart. Uses `setTimeout` with
`.unref()` so the process doesn't stay alive for tests.

First fire is 0ms after startup in dev (run immediately) and 1h after startup in production.
Subsequent fires are every 24 ± 2 hours.

### Surface Navigation

`PaneContent` gains a new variant `{ kind: 'cluster'; clusterId: number }`. The "show cluster"
button in `ReadingPane` calls `wb.openInPane(paneIndex === 0 ? 1 : 0, { kind: 'cluster', clusterId })`.

---

## Phase 0: Research Findings

| Question | Decision | Rationale |
|----------|----------|-----------|
| Vector access without QMD API | `store.internal.db` query directly | `QMDStore.internal: InternalStore` exposes `db: Database`; sqlite-vec is already loaded |
| k-means vs HDBSCAN | k-means | Hand-rollable; predictable at 10–500 docs; HDBSCAN min-cluster-size too constraining below ~100 docs |
| Library for k-means | None (hand-roll) | ~30 lines; no bundle impact; tech-stack gate avoided |
| Cluster ID stability | Ephemeral per run | MVP decision; bookmarked URLs get 404 after re-cluster; acceptable per spec Assumption 2 |
| Resurfacing heuristic | Never-surfaced-first, then by age, 7-day skip | See spec F3 (clarified) |

---

## Phase 1: Design Artifacts

### Data Model

See `specs/018-resurface-and-clustering/data-model.md`.

### API Contracts

See `specs/018-resurface-and-clustering/contracts/`.

---

## Implementation Tasks

### T1 — Database migrations

**Files to create:**
- `spine/migrations/015_surfaced.sql`
- `spine/migrations/016_clusters.sql`

`015_surfaced.sql`:
```sql
CREATE TABLE surfaced (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  target_kind TEXT NOT NULL,
  target_id   TEXT NOT NULL,
  surfaced_at TEXT NOT NULL,
  reason      TEXT,
  dismissed_at TEXT
);
CREATE INDEX idx_surfaced_date ON surfaced(surfaced_at);
CREATE INDEX idx_surfaced_dismissed ON surfaced(dismissed_at);
```

`016_clusters.sql`:
```sql
CREATE TABLE clusters (
  id     INTEGER PRIMARY KEY AUTOINCREMENT,
  run_at TEXT NOT NULL,
  label  TEXT
);

CREATE TABLE cluster_memberships (
  cluster_id  INTEGER NOT NULL REFERENCES clusters(id) ON DELETE CASCADE,
  target_kind TEXT NOT NULL,
  target_id   TEXT NOT NULL,
  PRIMARY KEY (cluster_id, target_kind, target_id)
);

CREATE INDEX idx_cluster_memberships_doc
  ON cluster_memberships(target_kind, target_id);
```

---

### T2 — Expose `getQmdStore()` from search.ts

**File to modify:** `spine/src/search.ts`

Add one export after the existing `_store` declaration area:

```typescript
export function getQmdStore(): QMDStore | null {
    return _store;
}
```

---

### T3 — spine/src/cluster.ts (core logic)

New file. Responsibilities:
1. `readEmbeddedDocs(db: QMD_Database)` — query `vectors_vec` joined to `documents`, return `Array<{ collection, path, targetKind, targetId, vector: Float32Array }>`
2. `kmeans(points, k)` — hand-rolled k-means, returns `Array<{ centroid: Float32Array, members: number[] }>`
3. `refreshClusters(latticeDb: Database)` — atomically replaces `clusters` + `cluster_memberships`
4. `selectResurfaceItems(latticeDb: Database)` — per-cluster picks based on spec F3 heuristic
5. `runResurfacePass(latticeDb: Database)` — calls (3) if no clusters, then (4), writes to `surfaced`

Key implementation detail for `runResurfacePass` idempotency: before writing, check whether
a row already exists in `surfaced` for the same item with `surfaced_at` date equal to today.
Use `DATE(surfaced_at) = DATE('now')` in the skip query.

Document creation-date lookup:
```typescript
// For captures:
db.query('SELECT ingested_at FROM captures WHERE id = ?').get(parseInt(targetId))
// For working docs:
// stat the .md file mtime (working docs table has modified_at via working.ts)
db.query('SELECT modified_at FROM working_docs WHERE slug = ?').get(targetId)
// For local files: use file_index.modified_at
db.query('SELECT modified_at FROM file_index WHERE path = ?').get(targetId)
```

Wait — need to check the working docs table. The spine `working.ts` uses a `slug.md` file;
modified_at is read from the filesystem. There may not be a `working_docs` table. Check
`spine/src/working.ts` to confirm the working doc schema.

---

### T4 — spine/src/resurface.ts (background timer)

New file. Mirrors `startEmbeddingBackfill`/`stopEmbeddingBackfill` from `search.ts`:
- `startResurfaceTimer(db: Database)` — idempotent, sets a timer to run `runResurfacePass`
- `stopResurfaceTimer()` — clears the timer

Initial delay: production uses a random jitter in [60, 120] minutes after startup to avoid
hammering on every restart. Subsequent interval: 24 hours ± 2h jitter.

In tests, export `__runResurfaceForTests(db)` that calls `runResurfacePass` directly.

---

### T5 — spine/src/routes/resurfaced.ts

New Elysia route file:
```
GET  /api/resurfaced              → today's non-dismissed surfaced items with snippets
POST /api/resurfaced/:id/dismiss  → sets dismissed_at = now()
```

For each surfaced item, fetch the snippet from the source document:
- `capture` → `SELECT substr(text, 1, 200) FROM captures WHERE id = ?`
- `working` → read first 200 chars of `working/{slug}.md` body (after frontmatter)
- `local-file` → `SELECT substr(text, 1, 200) FROM file_index WHERE path = ?`

Response shape for GET:
```typescript
interface ResurfacedResponse {
  items: Array<{
    id: number;
    target_kind: string;
    target_id: string;
    reason: string | null;
    snippet: string;
    title: string;
  }>;
}
```

---

### T6 — spine/src/routes/clusters.ts

New Elysia route file:
```
GET /api/cluster/:id              → cluster members with snippets; 404 if not found
GET /api/cluster/doc/:kind/:id    → { clusterId: number | null } for a document
```

Members response shape:
```typescript
interface ClusterMemberItem {
  target_kind: string;
  target_id: string;
  title: string;
  snippet: string;
}
interface ClusterResponse {
  id: number;
  run_at: string;
  members: ClusterMemberItem[];
}
```

---

### T7 — Wire into app.ts and index.ts

**`spine/src/app.ts`** — import and register `resurfacedRoutes(db)` and `clusterRoutes(db)`.

**`spine/src/index.ts`** — after `await initSearch(db)`, add:
```typescript
import { startResurfaceTimer } from './resurface';
startResurfaceTimer(db);
```

---

### T8 — surface/src/lib/types.ts

Add to `PaneContent`:
```typescript
| { kind: 'cluster'; clusterId: number }
```

Add API response types:
```typescript
export interface ResurfacedItem {
  id: number;
  target_kind: string;
  target_id: string;
  reason: string | null;
  snippet: string;
  title: string;
}

export interface ClusterMember {
  target_kind: string;
  target_id: string;
  title: string;
  snippet: string;
}

export interface ClusterDetail {
  id: number;
  run_at: string;
  members: ClusterMember[];
}
```

---

### T9 — surface/src/lib/api/resurfaced.ts

New API client:
```typescript
export const resurfacedKeys = {
  today: () => ['resurfaced', 'today'] as const
};

export function fetchResurfaced(): Promise<{ items: ResurfacedItem[] }>;
export function dismissResurfaced(id: number): Promise<{ ok: boolean }>;
```

### T10 — surface/src/lib/api/clusters.ts

New API client:
```typescript
export const clusterKeys = {
  detail: (id: number) => ['cluster', 'detail', id] as const,
  docCluster: (kind: string, targetId: string) => ['cluster', 'doc', kind, targetId] as const
};

export function fetchCluster(id: number): Promise<ClusterDetail>;
export function fetchDocCluster(kind: string, targetId: string): Promise<{ clusterId: number | null }>;
```

---

### T11 — surface/src/components/home/Resurfaced.svelte

Replace mock data with real `createQuery` call:
- On load: `GET /api/resurfaced`
- On dismiss (any button): `POST /api/resurfaced/:id/dismiss`, then optimistically remove from list
- `MOCK_RESURFACED` and `TODO(spine)` comment removed
- DocRef mapping: `target_kind='capture'` → `{ kind: 'capture', id: parseInt(target_id) }`, `target_kind='working'` → `{ kind: 'working', slug: target_id }`
- Loading and error states: `<div class="resurf-empty soft">…</div>`
- If `items.length === 0` after load/dismiss, render nothing (section collapses in HomeView)

---

### T12 — surface/src/components/cluster/ClusterView.svelte

New component. Props: `{ paneIndex: 0 | 1; clusterId: number }`.

- Fetches cluster with `createQuery(() => ({ queryKey: clusterKeys.detail(clusterId), queryFn: () => fetchCluster(clusterId) })`
- Lists members as clickable rows (same card style as existing search results)
- Clicking a member calls `wb.openInPane(paneIndex, docRefFrom(member))`
- Shows 404/stale message if cluster is not found (cluster ID became invalid after re-run)
- Shows loading state

---

### T13 — surface/src/components/workbench/PaneRouter.svelte

Add cluster case:
```svelte
import ClusterView from '$components/cluster/ClusterView.svelte';
...
{:else if content.kind === 'cluster'}
    <ClusterView {paneIndex} clusterId={content.clusterId} />
```

---

### T14 — surface/src/components/workbench/PaneContainer.svelte

Add cluster to `paneTitle`:
```typescript
case 'cluster':
    return `cluster #${c.clusterId}`;
```

---

### T15 — surface/src/lib/state/workbench.svelte.ts

Add cluster to `isSameContent`:
```typescript
case 'cluster':
    return a.clusterId === (b as typeof a).clusterId;
```

---

### T16 — surface/src/components/reading/ReadingPane.svelte

Add "Show cluster" button to toolbar, gated by `wb.featureFlags.clusters`.

The button appears next to the "Similar" button. It needs to:
1. Fetch the cluster ID for the current doc via `/api/cluster/doc/:kind/:id` (using `createQuery`)
2. If `clusterId !== null`, show the button as enabled; if null, show disabled or hidden
3. On click: `wb.openInOther(paneIndex, { kind: 'cluster', clusterId })` (matches the `openMoreLikeThis` / `openMentions` pattern used by every other toolbar button that opens in the second pane)

Use a derived `lateralKind` and `lateralId` from the existing `ref`:
- `ref.kind === 'capture'` → kind=`capture`, id=`String(ref.id)`
- `ref.kind === 'working'` → kind=`working`, id=`ref.slug`
- `ref.kind === 'file'` → kind=`local-file`, id=`String(ref.id)` (use file path, not numeric id — needs lookup)
- `ref.kind === 'archive'` → no cluster (archives are not clustered)

For local files, `target_id` in the cluster table is the file path, not the numeric id.
Need to fetch the path from the file query result. This means the cluster button for local
files depends on the file query completing first.

Simpler: only show "Show cluster" for `capture` and `working` refs (where target_id is
unambiguous). Local files can be added in a follow-up once the path mapping is clear.

---

### T17 — Tests

**`spine/src/cluster.test.ts`** (new):
- Unit test: `kmeans` with synthetic 5-point vectors → 2 clusters
- Unit test: `runResurfacePass` idempotency (second call on same day does not duplicate)
- Unit test: `selectResurfaceItems` skips items surfaced within 7 days

**`spine/src/routes/resurfaced.test.ts`** (new):
- Integration test: `GET /api/resurfaced` returns today's non-dismissed items
- Integration test: `POST /api/resurfaced/:id/dismiss` sets dismissed_at

---

## Implementation Order

```
T1 (migrations) → T2 (getQmdStore) → T3 (cluster.ts) → T4 (resurface.ts)
  → T5 (routes/resurfaced.ts) → T6 (routes/clusters.ts)
  → T7 (wire app.ts + index.ts)
  → T8 (types.ts) → T9 (api/resurfaced.ts) → T10 (api/clusters.ts)
  → T11 (Resurfaced.svelte) → T12 (ClusterView.svelte)
  → T13 (PaneRouter) → T14 (PaneContainer) → T15 (workbench.svelte.ts)
  → T16 (ReadingPane) → T17 (tests)
```

Spine can be built and tested independently of surface. T1–T7 form the complete backend.
T8–T17 are the complete frontend.

---

## Open Questions for Implementation

1. **Working docs table name**: `spine/src/working.ts` — check if there is a `working_docs`
   table or if working docs are filesystem-only. If filesystem-only, read `modified_at` from
   the file stat.

2. **Local file path vs ID in cluster table**: `target_id` for local files should be the file
   path (as used in `file_index.path`), not the numeric `id`. The "show cluster" affordance in
   ReadingPane for `ref.kind === 'file'` requires resolving `ref.id` → `path`. This is deferred
   to a follow-up; the `ref.kind === 'file'` case can simply not show the cluster button in
   the initial implementation.

3. **`reason` string vocabulary**: the pass should pick from a small set of templates:
   - `"Not visited in a while"` (never surfaced before, older doc)
   - `"Been a while"` (surfaced before but not recently)
   - `"From around this time"` (doc created/captured in the same calendar month in a prior year)
   The third variant requires comparing `ingested_at` month/day to current date. Start with
   first two only.
