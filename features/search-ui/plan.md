> BACKFILLED ARTIFACT
> Reverse-engineered from `surface/src/components/search/` on 2026-05-23.
> This is NOT the original intent of the feature; it is an inferred
> description based on code inspection. Treat as documentation, not spec.

# Plan: Search UI

## 1. Architecture As-Is

```
surface/src/components/search/
  Facets.svelte     - collapsible sidebar: kind filter, sort, cluster stubs, saved search stubs
  ResultList.svelte - TanStack Query wrapper: drives mentions/similar/nearby queries
  ResultRow.svelte  - individual result card: open, split, promote, similar actions
  search.css        - shared styles (imported by search route page, assumed)

Depends on:
  $lib/api/search   - fetchSearch(), fetchSimilar(), fetchNearby(), searchKeys
  $lib/api/working  - createWorking()
  $lib/state/workbench.svelte - getWorkbenchContext(), openInPane(), openInOther()
  $lib/types        - SearchResult, LateralSource, DocRef
  $components/icons/Icon.svelte
  $lib/utils/relTime
```

## 2. Data Model (client-side types)

`SearchResult` union:
- `capture`: id, score, snippet, body, path, modified_at
- `local-file`: id, score, snippet, body, path, machine_id, modified_at
- `working`: id, score, snippet, slug, modified_at
- `capture-attachment`: id, capture_id, filename, score, ...
- `working-attachment`: id, slug, filename, score, ...

`LateralSource` union: `mentions {q}` | `similar {id, docKind}` | `nearby {timestamp, window_hours}`

## 3. API Contracts (consumed)

- `GET /api/search?q=` via `fetchSearch()`
- `GET /api/similar?kind=&id=` via `fetchSimilar()`
- `GET /api/similar?kind=nearby&ts=&window_hours=` via `fetchNearby()` (NEEDS-CLARIFICATION on exact shape)
- `POST /api/working` via `createWorking()` for promote action

## 4. Dependencies

- `@tanstack/svelte-query` for data fetching and caching
- SvelteKit `$app/environment` (`browser` guard) to prevent SSR queries
- Workbench state context for pane navigation

## 5. Known Technical Debt

- Two explicit TODOs for unimplemented features:
  - Cluster facets: `TODO(spine): query GET /api/search/clusters?q=…` — endpoint not yet shipped
  - Saved searches: `TODO(spine): saved searches need an endpoint` — static placeholders only
- `ResultRow` sort label is `"Recency-broken"` (likely a placeholder name).
- `promoteError` state on ResultRow has no clear-on-navigate behavior; stale error could persist
  if pane is reused.
