# Implementation Plan: Remote Inference

## Technology context

- **spine**: TypeScript / Bun / Elysia. Search in `spine/src/search.ts`, routes in
  `spine/src/routes/search.ts` and `spine/src/routes/status.ts`. QMD via `@tobilu/qmd` 2.5.3 (vendored).
- **surface**: SvelteKit / Svelte 5 runes. Search UI in `surface/src/components/home/LibraryView.svelte`,
  client state in `surface/src/lib/state/workbench.svelte.ts`, API in `surface/src/lib/api/search.ts`.
- Tests: `bun test` (spine). Lint/format/check via root `just lint` / `just fmt` / `just check`.

## Architecture decisions

1. **One adaptive search path.** Replace `search()` + `searchDeep()` with a single async
   `search(q): Promise<{ results: SearchResult[]; degraded: boolean }>`:
   - Try `store.search({ query: q, limit: 20 })` (full: expand + multi-signal + rerank, remote).
   - On any thrown error (breaker-open / request failure / expansion failure), catch and fall back to
     `store.searchLex(q, { limit: 20 })`, adapt rows into `mapResults()` input, return `degraded: true`.
   - On success return `degraded: false`. Update a module-level `_degraded` flag accordingly.
   - Keep the existing query normalization only where still needed (the full path auto-expands a raw
     string and does not need the structuredSearch normalization; the BM25 fallback uses the raw query
     since `searchLex` builds its own FTS5 query).
2. **Degraded observability.** Export `isSearchDegraded(): boolean` from `search.ts`. `/api/search`
   returns `{ results, degraded }`. `/api/status` includes `search_degraded` and `needs_embedding`.
3. **Durable backfill.** `refreshIndex()` always awaits `store.update()` (lexical, immediate) and then
   attempts `store.embed()` guarded so embed failure never rejects the lock chain. Add
   `startEmbeddingBackfill()`: an interval tick that, while `getIndexHealth().needsEmbedding > 0`,
   attempts `store.embed()`; success clears `_degraded` embedding pressure, failure backs off. The
   needs-embedding state is persisted by QMD, so this resumes after restart. Started from `initSearch`.
4. **Surface.** `fetchSearch(q)` drops the `deep` param and returns `{ results, degraded }`. Remove
   `runDeepSearch`, `DeepSearchState`, and `deepSearch` from workbench. In `LibraryView`, remove the
   "Try deep search?" / "Deep search" controls and deep-result merge; render a "Keyword-only" badge
   when `searchQuery.data?.degraded` is true.

## Risks / tradeoffs

- **Catching too broadly** could mask real bugs as "degraded." Mitigation: fallback only swallows the
  remote failure for the search response (returns 200 degraded), but logs the error; non-remote errors
  in `searchLex` still propagate.
- **Backfill thrash** if embed keeps failing. Mitigation: exponential-ish backoff with a ceiling; only
  ticks when `needsEmbedding > 0`.
- **Test isolation**: tests must not hit a real endpoint. Use the existing `__resetSearchForTests` hooks
  and configure with no remote (local path) or a stubbed store where needed; assert response shape and
  fallback behavior at the `search()`/route boundary.

## Files to change

- `spine/src/search.ts` -- unify search, fallback adapter, degraded flag, backfill loop.
- `spine/src/routes/search.ts` -- return `degraded`, drop `deep`/`searchDeep`.
- `spine/src/routes/status.ts` -- add `search_degraded` + `needs_embedding`.
- `surface/src/lib/api/search.ts` -- response type + drop `deep`.
- `surface/src/lib/state/workbench.svelte.ts` -- remove deep-search state/method.
- `surface/src/components/home/LibraryView.svelte` -- remove toggle, add indicator.
- `surface/src/lib/types` -- search response type if needed.
- Tests: `spine/src/search.test.ts` (or new), route tests.
- Docs: `config.toml.example` note if needed (already configured).
