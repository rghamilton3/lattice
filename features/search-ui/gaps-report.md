> BACKFILLED ARTIFACT
> Reverse-engineered from `surface/src/components/search/` on 2026-05-23.

# Gaps Report: search-ui

## 1. Summary Verdict

**High gap**

No component-level tests. Two features are explicitly stubbed with TODO comments
(cluster facets, saved searches). The sort label `"Recency-broken"` suggests an unfinished UX
state. No tracking plan, no monitoring setup, no ADRs.

## 2. Missing Artifacts

| Artifact | Status |
|----------|--------|
| `research/` - UX / competitor research for search interfaces | Missing |
| Component tests (Vitest + Testing Library for Svelte) | Missing entirely |
| E2E tests for search flow | Missing |
| Cluster facets implementation | Explicitly TODO — endpoint not yet shipped |
| Saved searches implementation | Explicitly TODO — endpoint not yet shipped |
| ADRs: TanStack Query choice, lateral query modes design | Missing |
| Tracking plan (search usage, empty-result rate, promote conversion) | Missing |
| Feature flag for deep search (LLM mode) — cost/latency implications | Missing |
| Release-readiness checklist | Missing |

## 3. Inferred vs Observed

| Claim | Source | Confidence |
|-------|--------|------------|
| Three lateral query modes: mentions / similar / nearby | ResultList.svelte query switching | HIGH |
| Kind filter is multi-select toggle | `kindFilter: Set<Kind>` | HIGH |
| Resize handle is draggable | `onResizeStart` prop + CSS cursor:col-resize | HIGH |
| Promote creates a new working doc seeded from capture/file | `createWorking()` call | HIGH |
| Cluster facets not yet functional | Explicit TODO comment | HIGH |
| Saved searches not yet functional | Explicit TODO comment | HIGH |
| "Recency-broken" label is a placeholder | Label text verbatim in code | MEDIUM |
| Score bar is CSS width percentage (0-100 normalized) | `Math.round(result.score * 100)%` | HIGH |
| promoteError state does not clear on pane navigate | No clear logic observed | MEDIUM |

## 4. Recommended Next Actions

1. **Add component tests** for ResultRow (open, promote, similar actions) and ResultList
   (loading/error/empty states) using Vitest + @testing-library/svelte.

2. **Implement or remove cluster facets stub** — either wire to `GET /api/search/clusters` when
   the endpoint ships, or remove the placeholder section to reduce UX noise.

3. **Implement or remove saved searches stub** — clarify design intent before adding the
   backend endpoint.

4. **Fix the "Recency-broken" label** to a real sort label (e.g. "Recency").

5. **Run tracking plan** to measure search engagement and empty-result rate.

6. **Clear promoteError** state when pane navigates away from the result context.
