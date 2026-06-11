# Feature 016: Remote Inference

## Summary

Lattice's spine routes QMD's embedding, reranking, and query-expansion to a remote
OpenAI-compatible inference endpoint (the vendored `@tobilu/qmd` 2.5.3 build of Kaspre's
`feat/remote-llm-openai-compatible` branch, PR #705). This feature makes search and indexing
**resilient to that endpoint being unavailable**: search degrades to keyword-only (BM25) when
the endpoint is down, captures made during an outage are immediately keyword-findable and gain
vector coverage after recovery, and the surface shows a "Keyword-only" indicator instead of
silently returning degraded results. The legacy fast/deep search toggle is removed in favor of a
single adaptive path.

## Background (current state)

- Commit `9d18aef` already vendored QMD 2.5.3 (with `RemoteLLM` + built-in circuit breakers) and
  wired `embed_api_url` / `rerank_api_url` / `expand_api_url` (+ model names) into spine config
  (`config.toml.example`, `spine/src/config.ts`).
- `spine/src/search.ts` exposes two paths: `search()` (lex+vec, `rerank:false` -- the "fast" path)
  and `searchDeep()` (`store.search({query})` -- expand+rerank, the "deep" path).
- `refreshIndex()` runs `store.update()` then `store.embed()` inline; failures are only counted.
- The surface exposes a fast default search plus a "Deep search (LLM expand + rerank)" button
  (`LibraryView.svelte`, `workbench.svelte.ts#runDeepSearch`, `fetchSearch(q, deep)`).

## Key constraint (resolved in clarification)

The deployment is **remote-only: no local LLM model is loaded.** QMD's vector search filters
candidates by `WHERE model = ? AND embed_fingerprint = ?`, so a query embedded by any model other
than the remote one matches zero stored vectors. Therefore **keyword-only mode is strictly BM25
(`store.searchLex`)** -- there is no local query embedding, no rerank, no expansion during an outage.

## Acceptance Criteria

1. **Full-quality through the endpoint.** With the endpoint up, a search request runs the
   full-quality pipeline (LLM query expansion + multi-signal retrieval + LLM rerank) via the remote
   endpoint and returns ranked results with `degraded: false`.
2. **Graceful degradation.** When the endpoint is unavailable (circuit breaker open / request
   failure), the same search request returns BM25 keyword results with `degraded: true` and HTTP
   200 -- search stays up, never 500s, and never runs rerank/expansion on CPU.
3. **Keyword-only indicator.** The surface displays a clear "Keyword-only" indicator whenever the
   latest search response is `degraded: true`, and removes it once full-quality results return.
   `/api/status` also reports the last-known degraded state.
4. **Durable, retryable index-time embedding.** A capture (or any indexed doc) created while the
   endpoint is down is indexed lexically immediately (keyword-findable) and is enqueued for
   embedding via QMD's persisted `needsEmbedding` state. A spine backfill loop retries `store.embed()`
   with backoff and, on endpoint recovery, embeds the pending docs so they gain vector coverage --
   surviving a spine restart.
5. **Toggle removed.** The fast/deep search toggle is gone from the surface and the `deep` query
   parameter / `searchDeep` server path are removed; one adaptive search path remains.

## Scope

### Included
- Unify spine search into one full-quality path with a BM25 fallback and a `degraded` flag.
- Per-response `degraded` flag on `/api/search`; degraded state surfaced on `/api/status`.
- A durable embedding backfill loop in spine that retries on recovery, leaning on QMD's persisted
  `needsEmbedding` state.
- Surface: remove the deep-search toggle/state; render a "Keyword-only" indicator.
- Tests covering: full path, degraded fallback, backfill-on-recovery, response shape.

### Explicitly excluded
- Any local embedding/rerank/expansion fallback (deployment is remote-only).
- Changes to the QMD vendored package itself.
- Provisioning/operating the inference endpoint (an external requirement, assumed available).
- Migrating existing embeddings or changing the embedding model.

## Technical Notes

- Degraded detection: `RemoteLLM`'s breakers are `private`; spine infers degraded mode by catching
  the failure thrown from `store.search()` (breaker-open errors and request failures) and falling
  back to `store.searchLex()`. A module-level `degraded` flag is set on fallback and cleared on a
  successful full search; the backfill loop also updates it.
- `store.searchLex()` returns rows whose `filepath` is the `qmd://collection/path` virtual path plus
  `body`/`displayPath`/`score`; these adapt into the existing `mapResults()` input shape (snippet via
  QMD's exported `extractSnippet`).
- Backfill: `refreshIndex()` always runs `update()` (lexical) and attempts `embed()`; on embed
  failure it does not error the request. A periodic backfill tick (and a post-recovery trigger)
  re-attempts `embed()` while `getIndexHealth().needsEmbedding > 0`.
