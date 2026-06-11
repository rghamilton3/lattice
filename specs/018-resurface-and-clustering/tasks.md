# Tasks: Resurfacing & Clustering

**Feature**: 018-resurface-and-clustering
**Branch**: `worktree-feat+resurface-and-clustering`
**Generated**: 2026-06-09
**Total tasks**: 17

<!-- Tech Stack Validation: PASSED -->
<!-- Validated against: .specswarm/tech-stack.md -->
<!-- No prohibited technologies found (TypeScript only; hand-rolled k-means; no new npm deps) -->

---

## Completion Tracker

- [X] T001 Write DB migration 015 (surfaced table) — `spine/migrations/015_surfaced.sql`
- [X] T002 Write DB migration 016 (clusters + cluster_memberships tables) — `spine/migrations/016_clusters.sql`
- [X] T003 Export `getQmdStore()` from search.ts — `spine/src/search.ts`
- [X] T004 Implement `spine/src/cluster.ts` (vector read, k-means, refreshClusters, selectResurfaceItems, runResurfacePass) — `spine/src/cluster.ts`
- [X] T005 Implement `spine/src/resurface.ts` (background timer, startResurfaceTimer, stopResurfaceTimer, __runResurfaceForTests) — `spine/src/resurface.ts`
- [X] T006 [P] Implement `spine/src/routes/resurfaced.ts` (GET /api/resurfaced, POST /api/resurfaced/:id/dismiss) — `spine/src/routes/resurfaced.ts`
- [X] T007 [P] Implement `spine/src/routes/clusters.ts` (GET /api/cluster/:id, GET /api/cluster/doc/:kind/:target_id) — `spine/src/routes/clusters.ts`
- [X] T008 Wire resurfaced + cluster routes and resurfacing timer into app.ts and index.ts — `spine/src/app.ts`, `spine/src/index.ts`
- [X] T009 Add cluster PaneContent variant and API types to surface types — `surface/src/lib/types.ts`
- [X] T010 [P] Implement `surface/src/lib/api/resurfaced.ts` (fetchResurfaced, dismissResurfaced) — `surface/src/lib/api/resurfaced.ts`
- [X] T011 [P] Implement `surface/src/lib/api/clusters.ts` (fetchCluster, fetchDocCluster) — `surface/src/lib/api/clusters.ts`
- [X] T012 Wire Resurfaced.svelte to live API (replace mock data with createQuery + optimistic dismiss) — `surface/src/components/home/Resurfaced.svelte`
- [X] T013 Create `surface/src/components/cluster/ClusterView.svelte` — `surface/src/components/cluster/ClusterView.svelte`
- [X] T014 [P] Add cluster case to PaneRouter.svelte — `surface/src/components/workbench/PaneRouter.svelte`
- [X] T015 [P] Add cluster title to PaneContainer.svelte and isSameContent to workbench.svelte.ts — `surface/src/components/workbench/PaneContainer.svelte`, `surface/src/lib/state/workbench.svelte.ts`
- [X] T016 Add "Show cluster" button to ReadingPane.svelte (gated by clusters feature flag) — `surface/src/components/reading/ReadingPane.svelte`
- [X] T017 [P] Write spine unit + integration tests (k-means, resurfacing pass idempotency, API routes) — `spine/src/cluster.test.ts`, `spine/src/routes/resurfaced.test.ts`

---

## Phase 1: Setup - DB Migrations

These two migrations must land before any spine logic can reference the new tables.

### T001 - Write migration 015: surfaced table
- [X] T001 Write DB migration 015 (surfaced table) — `spine/migrations/015_surfaced.sql`

**File**: `spine/migrations/015_surfaced.sql`

```sql
CREATE TABLE surfaced (
  id           INTEGER PRIMARY KEY AUTOINCREMENT,
  target_kind  TEXT NOT NULL,
  target_id    TEXT NOT NULL,
  surfaced_at  TEXT NOT NULL,
  reason       TEXT,
  dismissed_at TEXT
);
CREATE INDEX idx_surfaced_date      ON surfaced(surfaced_at);
CREATE INDEX idx_surfaced_dismissed ON surfaced(dismissed_at);
```

Write this file exactly. No other changes.

---

### T002 - Write migration 016: clusters + cluster_memberships
- [X] T002 Write DB migration 016 (clusters + cluster_memberships tables) — `spine/migrations/016_clusters.sql`

**File**: `spine/migrations/016_clusters.sql`

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

Write this file exactly. No other changes.

---

## Phase 2: Foundational - Spine Core Logic (US3: Background Pass)

These tasks implement the offline-safe background infrastructure that powers both the resurfacing panel (US1) and cluster browse (US2). All must complete before route tasks can be finished.

**Story Goal**: The nightly pass runs reliably, uses only stored data, and is idempotent.

**Independent Test**: Call `__runResurfaceForTests(db)` twice on the same day; verify the `surfaced` table has no duplicate `(target_kind, target_id, DATE(surfaced_at))` rows.

### T003 - Export getQmdStore() from search.ts
- [X] T003 Export `getQmdStore()` from search.ts — `spine/src/search.ts`

**File to modify**: `spine/src/search.ts`

Add after the existing `_store` declaration:
```typescript
export function getQmdStore(): QMDStore | null {
    return _store;
}
```

One export, no other changes.

---

### T004 - Implement spine/src/cluster.ts
- [X] T004 Implement `spine/src/cluster.ts` (vector read, k-means, refreshClusters, selectResurfaceItems, runResurfacePass) — `spine/src/cluster.ts`

**File to create**: `spine/src/cluster.ts`

Implement the following exported functions in order:

1. **`readEmbeddedDocs(db: Database)`** — query `vectors_vec` joined to `documents` via `content_vectors`:
   ```sql
   SELECT d.collection, d.path, v.embedding
   FROM vectors_vec v
   JOIN content_vectors cv
     ON cv.hash || '_' || cv.seq = v.hash_seq AND cv.seq = 0
   JOIN documents d ON d.hash = cv.hash
   WHERE d.active = 1
     AND d.collection IN ('captures', 'working', 'local-files')
   ```
   Decode each embedding `Buffer` as `new Float32Array(buf.buffer, buf.byteOffset, buf.byteLength / 4)`.
   Map `collection`/`path` to `targetKind`/`targetId`:
   - `captures` / `123.md` → kind=`capture`, id=`123`
   - `working` / `my-slug.md` → kind=`working`, id=`my-slug`
   - `local-files` / `machine/file.md` → kind=`local-file`, id=`machine/file.md`

2. **`kmeans(points: Float32Array[], k: number)`** — hand-rolled k-means++ with cosine distance:
   - k = `clamp(Math.round(Math.sqrt(n)), 2, 20)`
   - k-means++ seeding: pick first centroid randomly from actual points, then pick each subsequent centroid with probability proportional to squared distance from nearest existing centroid
   - Up to 100 iterations; stop early if assignments unchanged
   - Returns `Array<{ centroid: Float32Array; members: number[] }>`

3. **`refreshClusters(latticeDb: Database)`** — atomically replace all `clusters` + `cluster_memberships` rows:
   - Read vectors via `getQmdStore()?.internal.db` (return early if no QMD store)
   - If `n < 2`, return early (nothing to cluster)
   - Run `kmeans`, then in a single transaction: `DELETE FROM clusters` (cascades memberships), insert new cluster rows, insert membership rows

4. **`selectResurfaceItems(latticeDb: Database)`** — per-cluster selection per spec F3:
   - For each cluster, find members with no prior `surfaced` row at all (never surfaced), ordered by document age (oldest first). Skip any member with a `surfaced_at >= DATE('now', '-7 days')` row.
   - If all members are covered by the 7-day skip, skip the cluster.
   - Return `Array<{ targetKind, targetId, reason: string }>`.
   - Reason strings: `"Not visited in a while"` (never surfaced, older doc) or `"Been a while"` (previously surfaced but not recently).
   - For age lookup: captures use `SELECT ingested_at FROM captures WHERE id = ?`; working docs use `statSync(join(workingDir(), slug + '.md')).mtime`; local files use `SELECT modified_at FROM file_index WHERE path = ?`.

5. **`runResurfacePass(latticeDb: Database)`** — idempotent nightly pass:
   - If `clusters` table is empty, call `refreshClusters` first.
   - Call `selectResurfaceItems`.
   - For each selected item, check `SELECT 1 FROM surfaced WHERE target_kind=? AND target_id=? AND DATE(surfaced_at)=DATE('now')` — skip if exists (idempotency guard).
   - Insert new `surfaced` rows with `surfaced_at = new Date().toISOString()` and the reason string.

---

### T005 - Implement spine/src/resurface.ts
- [X] T005 Implement `spine/src/resurface.ts` (background timer, startResurfaceTimer, stopResurfaceTimer, __runResurfaceForTests) — `spine/src/resurface.ts`

**File to create**: `spine/src/resurface.ts`

Mirror the `startEmbeddingBackfill`/`stopEmbeddingBackfill` pattern from `search.ts`:

```typescript
import type { Database } from 'bun:sqlite';
import { runResurfacePass } from './cluster';

let _timer: Timer | null = null;

export function startResurfaceTimer(db: Database): void {
    if (_timer) return; // idempotent
    const IS_DEV = process.env.NODE_ENV !== 'production';
    const initialDelay = IS_DEV ? 0 : (60 + Math.random() * 60) * 60_000; // 0ms dev, 60–120min prod
    const interval = (24 + (Math.random() * 4 - 2)) * 60 * 60_000; // 22–26h

    const t = setTimeout(async () => {
        await runResurfacePass(db);
        _timer = setInterval(() => runResurfacePass(db), interval) as unknown as Timer;
        (_timer as unknown as ReturnType<typeof setInterval>).unref?.();
    }, initialDelay);
    (t as unknown as ReturnType<typeof setTimeout>).unref?.();
    _timer = t as unknown as Timer;
}

export function stopResurfaceTimer(): void {
    if (_timer) { clearTimeout(_timer as unknown as ReturnType<typeof setTimeout>); _timer = null; }
}

export async function __runResurfaceForTests(db: Database): Promise<void> {
    await runResurfacePass(db);
}
```

---

## Phase 3: User Story 1 - Resurfaced Items on Landing (P1)

**Story Goal**: Home screen shows a "From your past" panel with items from the `surfaced` table. Users can click to open, dismiss to remove.

**Independent Test**: With `resurfacing` flag on, `GET /api/resurfaced` returns items; `POST /api/resurfaced/:id/dismiss` sets `dismissed_at`; home panel renders items and collapses when all are dismissed.

### T006 - Implement spine/src/routes/resurfaced.ts
- [X] T006 [P] Implement `spine/src/routes/resurfaced.ts` (GET /api/resurfaced, POST /api/resurfaced/:id/dismiss) — `spine/src/routes/resurfaced.ts`

**File to create**: `spine/src/routes/resurfaced.ts`

Implement an Elysia plugin exporting `resurfacedRoutes(db: Database)`:

**GET /api/resurfaced** — returns today's non-dismissed surfaced items:
```sql
SELECT * FROM surfaced
WHERE DATE(surfaced_at) = DATE('now')
  AND dismissed_at IS NULL
ORDER BY id
```
For each row, fetch snippet and title by `target_kind`:
- `capture` → `SELECT substr(text, 1, 200) AS snippet, substr(text, 1, 60) AS title FROM captures WHERE id = ?` (parseInt target_id)
- `working` → read first 200 chars after frontmatter from `{workingDir()}/{target_id}.md`; title = first non-empty line or slug
- `local-file` → `SELECT substr(text, 1, 200) AS snippet FROM file_index WHERE path = ?`; title = `basename(target_id)`

Response: `{ items: ResurfacedItem[] }` (see contracts/resurfaced.ts).

**POST /api/resurfaced/:id/dismiss** — sets `dismissed_at = now()`:
```sql
UPDATE surfaced SET dismissed_at = ? WHERE id = ?
```
Return `{ ok: true }`. Return 404 if no row found for `id`.

---

### T010 - Implement surface/src/lib/api/resurfaced.ts
- [X] T010 [P] Implement `surface/src/lib/api/resurfaced.ts` (fetchResurfaced, dismissResurfaced) — `surface/src/lib/api/resurfaced.ts`

**File to create**: `surface/src/lib/api/resurfaced.ts`

```typescript
import type { ResurfacedItem } from '$lib/types';

export const resurfacedKeys = {
    today: () => ['resurfaced', 'today'] as const
};

export async function fetchResurfaced(): Promise<{ items: ResurfacedItem[] }> {
    const res = await fetch('/api/resurfaced');
    if (!res.ok) throw new Error('Failed to fetch resurfaced items');
    return res.json();
}

export async function dismissResurfaced(id: number): Promise<{ ok: boolean }> {
    const res = await fetch(`/api/resurfaced/${id}/dismiss`, { method: 'POST' });
    if (!res.ok) throw new Error('Failed to dismiss item');
    return res.json();
}
```

---

### T012 - Wire Resurfaced.svelte to live API
- [X] T012 Wire Resurfaced.svelte to live API (replace mock data with createQuery + optimistic dismiss) — `surface/src/components/home/Resurfaced.svelte`

**File to modify**: `surface/src/components/home/Resurfaced.svelte`

- Remove `MOCK_RESURFACED` and any `TODO(spine)` comments.
- Add `createQuery` using `resurfacedKeys.today()` / `fetchResurfaced()`.
- On dismiss (any of the three buttons: Useful, Not now, Don't resurface): call `dismissResurfaced(item.id)`, then optimistically remove the item from the local list before refetch.
- Map `target_kind` to `DocRef`:
  - `capture` → `{ kind: 'capture', id: parseInt(target_id) }`
  - `working` → `{ kind: 'working', slug: target_id }`
  - `local-file` → skip or show as plain text (no navigation for now)
- If `items.length === 0` after load or after all dismissals, render nothing (parent collapses section).
- Show a loading skeleton while query is pending. Show nothing (not an error state) on fetch error.

---

## Phase 4: User Story 2 - Cluster Browse (P2)

**Story Goal**: A document viewer shows a "Show cluster" affordance. Clicking opens the cluster in the second pane (split view).

**Independent Test**: With `clusters` flag on and clustering pass run, a capture or working doc with a cluster assignment shows the "Show cluster" button; clicking it opens `ClusterView` in pane 2 with all cluster members listed.

### T007 - Implement spine/src/routes/clusters.ts
- [X] T007 [P] Implement `spine/src/routes/clusters.ts` (GET /api/cluster/:id, GET /api/cluster/doc/:kind/:target_id) — `spine/src/routes/clusters.ts`

**File to create**: `spine/src/routes/clusters.ts`

Implement an Elysia plugin exporting `clusterRoutes(db: Database)`.

**IMPORTANT**: Register `GET /api/cluster/doc/:kind/:target_id` BEFORE `GET /api/cluster/:id` to prevent `:id` from matching `"doc"`.

**GET /api/cluster/doc/:kind/:target_id** — returns `{ clusterId: number | null }`:
```sql
SELECT cluster_id FROM cluster_memberships
WHERE target_kind = ? AND target_id = ?
```
Return `{ clusterId: row?.cluster_id ?? null }`.

**GET /api/cluster/:id** — returns cluster members with snippets:
```sql
SELECT * FROM clusters WHERE id = ?
```
Return 404 if no cluster found. Then:
```sql
SELECT target_kind, target_id FROM cluster_memberships WHERE cluster_id = ?
```
Fetch snippet and title for each member using the same logic as the resurfaced route. Return `GetClusterResponse` (see contracts/clusters.ts).

---

### T009 - Add cluster PaneContent variant and API types
- [X] T009 Add cluster PaneContent variant and API types to surface types — `surface/src/lib/types.ts`

**File to modify**: `surface/src/lib/types.ts`

Add to the `PaneContent` union:
```typescript
| { kind: 'cluster'; clusterId: number }
```

Add the following interfaces:
```typescript
export interface ResurfacedItem {
    id: number;
    target_kind: 'capture' | 'working' | 'local-file';
    target_id: string;
    reason: string | null;
    snippet: string;
    title: string;
}

export interface ClusterMember {
    target_kind: 'capture' | 'working' | 'local-file';
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

### T011 - Implement surface/src/lib/api/clusters.ts
- [X] T011 [P] Implement `surface/src/lib/api/clusters.ts` (fetchCluster, fetchDocCluster) — `surface/src/lib/api/clusters.ts`

**File to create**: `surface/src/lib/api/clusters.ts`

```typescript
import type { ClusterDetail } from '$lib/types';

export const clusterKeys = {
    detail: (id: number) => ['cluster', 'detail', id] as const,
    docCluster: (kind: string, targetId: string) => ['cluster', 'doc', kind, targetId] as const
};

export async function fetchCluster(id: number): Promise<ClusterDetail> {
    const res = await fetch(`/api/cluster/${id}`);
    if (res.status === 404) throw new Error('Cluster not found');
    if (!res.ok) throw new Error('Failed to fetch cluster');
    return res.json();
}

export async function fetchDocCluster(kind: string, targetId: string): Promise<{ clusterId: number | null }> {
    const res = await fetch(`/api/cluster/doc/${kind}/${encodeURIComponent(targetId)}`);
    if (!res.ok) throw new Error('Failed to fetch doc cluster');
    return res.json();
}
```

---

### T013 - Create ClusterView.svelte
- [X] T013 Create `surface/src/components/cluster/ClusterView.svelte` — `surface/src/components/cluster/ClusterView.svelte`

**File to create**: `surface/src/components/cluster/ClusterView.svelte`

Props: `{ paneIndex: 0 | 1; clusterId: number }`.

- Fetch with `createQuery(() => ({ queryKey: clusterKeys.detail(clusterId), queryFn: () => fetchCluster(clusterId) }))`.
- Show loading state while pending.
- If cluster is not found (error from 404), show a soft message: "This cluster is no longer available — it may have been updated. Try reopening from a document."
- List members as clickable rows: same card/row style as existing search result items.
- Each member click calls `wb.openInPane(paneIndex, docRefFrom(member))` where:
  - `target_kind='capture'` → `{ kind: 'capture', id: parseInt(target_id) }`
  - `target_kind='working'` → `{ kind: 'working', slug: target_id }`
  - `target_kind='local-file'` → skip navigation (no reliable DocRef yet)

---

### T014 - Add cluster case to PaneRouter.svelte
- [X] T014 [P] Add cluster case to PaneRouter.svelte — `surface/src/components/workbench/PaneRouter.svelte`

**File to modify**: `surface/src/components/workbench/PaneRouter.svelte`

Add import:
```svelte
import ClusterView from '$components/cluster/ClusterView.svelte';
```

In the `{#if}` / `{:else if}` chain, add:
```svelte
{:else if content.kind === 'cluster'}
    <ClusterView {paneIndex} clusterId={content.clusterId} />
```

---

### T015 - Add cluster support to PaneContainer and workbench state
- [X] T015 [P] Add cluster title to PaneContainer.svelte and isSameContent to workbench.svelte.ts — `surface/src/components/workbench/PaneContainer.svelte`, `surface/src/lib/state/workbench.svelte.ts`

**Files to modify**:

`PaneContainer.svelte` — add to `paneTitle` switch/case:
```typescript
case 'cluster':
    return `cluster #${c.clusterId}`;
```

`workbench.svelte.ts` — add to `isSameContent`:
```typescript
case 'cluster':
    return a.clusterId === (b as typeof a).clusterId;
```

---

### T016 - Add "Show cluster" button to ReadingPane.svelte
- [X] T016 Add "Show cluster" button to ReadingPane.svelte (gated by clusters feature flag) — `surface/src/components/reading/ReadingPane.svelte`

**File to modify**: `surface/src/components/reading/ReadingPane.svelte`

Add a `createQuery` for the doc's cluster ID, derived from the current `ref`:
- `ref.kind === 'capture'` → kind=`capture`, targetId=`String(ref.id)`
- `ref.kind === 'working'` → kind=`working`, targetId=`ref.slug`
- Other kinds (`file`, `archive`) → skip (no cluster button shown)

Query: `fetchDocCluster(kind, targetId)` using `clusterKeys.docCluster(kind, targetId)`.

Add a "Show cluster" button next to the existing "Similar" button in the toolbar:
- Only render when `wb.featureFlags.clusters` is true AND `ref.kind` is `capture` or `working`.
- Enabled when `clusterId !== null`; hidden (not disabled) when `clusterId === null`.
- On click: `wb.openInOther(paneIndex, { kind: 'cluster', clusterId })` — this matches the pattern used by `openMoreLikeThis` / `openMentions`.

---

## Phase 5: Integration - Wire Backend

### T008 - Wire routes and timer into app.ts and index.ts
- [X] T008 Wire resurfaced + cluster routes and resurfacing timer into app.ts and index.ts — `spine/src/app.ts`, `spine/src/index.ts`

**`spine/src/app.ts`** — import and register both route plugins:
```typescript
import { resurfacedRoutes } from './routes/resurfaced';
import { clusterRoutes } from './routes/clusters';

// Inside the app factory, after existing route registrations:
app.use(resurfacedRoutes(db));
app.use(clusterRoutes(db));
```

**`spine/src/index.ts`** — start the background timer after `initSearch`:
```typescript
import { startResurfaceTimer } from './resurface';
// After: await initSearch(db);
startResurfaceTimer(db);
```

---

## Phase 6: Tests (US3 + US1 backend)

### T017 - Write spine unit and integration tests
- [X] T017 [P] Write spine unit + integration tests (k-means, resurfacing pass idempotency, API routes) — `spine/src/cluster.test.ts`, `spine/src/routes/resurfaced.test.ts`

**`spine/src/cluster.test.ts`** (unit tests):
- `kmeans` with 5 synthetic 768-dim vectors assigned to 2 known groups → verify they cluster correctly
- `runResurfacePass` called twice on the same day → `SELECT COUNT(*) FROM surfaced WHERE DATE(surfaced_at)=DATE('now')` must not increase on the second call (idempotency)
- `selectResurfaceItems` — seed `surfaced` with a row from 3 days ago for item A; verify item A is still returned (3 days < 7-day skip window does not apply until day 8); seed with 6-day-ago row; verify A is skipped

**`spine/src/routes/resurfaced.test.ts`** (integration tests, Elysia test client):
- `GET /api/resurfaced` — seed `surfaced` with today's non-dismissed row; verify response contains item with correct shape
- `POST /api/resurfaced/:id/dismiss` — dismiss a surfaced row; verify `dismissed_at` is set and the item no longer appears in `GET /api/resurfaced`
- `GET /api/resurfaced` with no rows → `{ items: [] }`

---

## Dependencies

```
T001, T002 (migrations) must precede T004, T006, T007 (any DB access)
T003 (getQmdStore export) must precede T004 (cluster.ts reads vectors)
T004 (cluster.ts) must precede T005 (resurface.ts imports runResurfacePass)
T005, T006, T007 must precede T008 (wire into app)
T009 (types.ts) must precede T010, T011, T012, T013 (API clients + components use types)
T010 must precede T012 (Resurfaced.svelte imports fetchResurfaced)
T011 must precede T013, T016 (ClusterView + ReadingPane import fetchCluster, fetchDocCluster)
T013 must precede T014 (PaneRouter imports ClusterView)
T009 must precede T014, T015 (PaneRouter + workbench handle new PaneContent variant)
```

## Parallel Opportunities

**Spine backend** (after T001–T003):
- T004 and T005 are sequential (T005 imports T004)
- T006 and T007 can run in parallel once T001 is done

**Surface frontend** (after T009):
- T010 and T011 can run in parallel
- T014 and T015 can run in parallel (after T009, T013)

**Tests** (T017) can begin once T001–T008 are complete.

## Implementation Strategy

**MVP scope** (unblocks US1 completely): T001 → T002 → T003 → T004 → T005 → T006 → T008 → T009 → T010 → T012

**Full feature** (adds cluster browse / US2): + T007 → T011 → T013 → T014 → T015 → T016

**Tests** (P5 constitution requirement): T017 after T001–T008
