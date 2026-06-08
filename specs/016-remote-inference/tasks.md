# Tasks: Remote Inference

Dependency-ordered. `[P]` = parallelizable with siblings.

### T001 - Unify spine search into one adaptive path with degraded flag
`spine/src/search.ts`. Replace `search()` and `searchDeep()` with a single
`search(q): Promise<{ results: SearchResult[]; degraded: boolean }>`:
- Try `store.search({ query: q, limit: 20 })` (full: expand + retrieve + rerank).
- Catch remote failure -> `store.searchLex(q, { limit: 20 })`, adapt rows (`filepath`->`file`,
  `extractSnippet(body, q)`->`bestChunk`) into `mapResults()` input; return `degraded: true`.
- Maintain module-level `_degraded`; export `isSearchDegraded()`. Log caught errors.
Keep `__resetSearchForTests`; add `__setStoreForTests(store)` for injection.

### T002 - Durable embedding backfill loop
`spine/src/search.ts`. `refreshIndex()` always runs `update()`; attempt `embed()` guarded so failure
never rejects the lock chain. Add `startEmbeddingBackfill()` (interval) that, while
`getIndexHealth().needsEmbedding > 0`, retries `embed()` with backoff; clears embedding pressure on
success. Add `stopEmbeddingBackfill()` for clean shutdown/tests. Start it from `initSearch`.

### T003 - Update /api/search route [P after T001]
`spine/src/routes/search.ts`. Return `{ results, degraded }`. Remove the `deep` query param and the
`searchDeep` import/branch.

### T004 - Surface degraded + needs-embedding on /api/status [P after T001,T002]
`spine/src/routes/status.ts`. Add `search_degraded: isSearchDegraded()` and a needs-embedding count
(from the search module). Keep response backward-compatible (additive fields).

### T005 - Surface API: drop deep param, add degraded to response type [P after T003]
`surface/src/lib/api/search.ts`. `fetchSearch(q)` returns `{ results: SearchResult[]; degraded: boolean }`,
no `deep` argument.

### T006 - Remove deep-search client state [P after T005]
`surface/src/lib/state/workbench.svelte.ts`. Remove `DeepSearchState`, `deepSearch` field, and
`runDeepSearch()`.

### T007 - LibraryView: remove toggle, add "Keyword-only" indicator [after T005,T006]
`surface/src/components/home/LibraryView.svelte`. Remove "Try deep search?" / "Deep search" controls
and the deep-result merge; results come solely from `searchQuery`. Render a "Keyword-only" badge when
`searchQuery.data?.degraded` is true; hide it otherwise.

### T008 - Tests [after T001-T004]
`spine/src/search.test.ts` (new): inject a fake store via `__setStoreForTests` to assert
(a) full path returns `degraded:false`, (b) `store.search` throwing falls back to `searchLex` with
`degraded:true` and mapped results, (c) backfill retries `embed()` until `needsEmbedding` is 0.
Route test: `/api/search` returns `{ results, degraded }` and no longer honors `deep`.

### T009 - Docs/config note [P]
`config.toml.example` / `spine/CLAUDE.md`: note remote-only behavior + keyword-only fallback. Confirm
`/api/search` contract change documented.

### T010 - Verify: lint, format, typecheck, tests
`just fmt && just lint && just check && just test` (or spine-scoped equivalents). All green.
