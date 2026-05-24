> BACKFILLED ARTIFACT
> Reverse-engineered from `surface/src/components/search/` on 2026-05-23.
> This is NOT the original intent of the feature; it is an inferred
> description based on code inspection. Treat as documentation, not spec.

# Search UI

## 1. Feature Summary

The search UI is a SvelteKit component set that renders search results inside the Lattice
surface workbench. It consists of a collapsible facet sidebar (Facets.svelte), a results list
driven by TanStack Query (ResultList.svelte), and an individual result card that supports
open, split-open, promote-to-working-doc, and find-similar actions (ResultRow.svelte).
Three lateral query modes are supported: `mentions` (keyword search), `similar` (vector similarity
by doc), and `nearby` (time-window capture neighbours).

## 2. Target Users

Single self-hosted user browsing their own knowledge base via the Lattice surface.

## 3. Primary User Stories

- As a user, I can type a query and see ranked results across captures, local files, and
  working docs.
- As a user, I can filter results by kind (capture / local-file / working) using the facet
  sidebar.
- As a user, I can sort results by recency or score.
- As a user, I can open a result directly or in a split pane.
- As a user, I can promote a capture or local file to a new working doc with one click.
- As a user, I can find documents similar to any result with the "Similar" action.
- As a user, I can collapse the facet sidebar to maximise the results pane.
- As a user, the facet sidebar is resizable by dragging its right edge.

## 4. In-Scope / Out-of-Scope

**In scope (observed):**
- Kind filter (capture / local-file / working) as toggle-chip facets.
- Sort by recency or score.
- Mentions, similar, and nearby lateral query modes.
- Result card: kind chip, machine ID badge for local files, title, modified time, score bar, actions.
- Promote action to create a new working doc seeded from a capture or file.
- Collapsible facet sidebar with resize handle.

**Out-of-scope (observed TODOs — not yet implemented):**
- Cluster facets (HDBSCAN labels via `GET /api/search/clusters?q=`) — static placeholder shown.
- Saved searches panel — three static placeholders (`Active research`, `Open questions`,
  `Waiting on someone`) are shown but disabled.

## 5. Non-Functional Reality

- **State management**: Workbench context (`getWorkbenchContext()`) mediates pane navigation;
  TanStack Query caches lateral queries by `[kind, id]` key.
- **Error handling**: Query errors displayed inline in results area; promote errors shown inline
  per-result.
- **Loading states**: "loading…" text shown while queries are in flight.
- **Empty state**: "no results" text when result set is empty.
- **No debounce** visible in these components — assumed to live in the parent search view.
- **score bar** rendered as a CSS width percentage (0-100%) based on normalized score.

## 6. Open Questions

- NEEDS-CLARIFICATION: When will cluster facets be wired to the real endpoint?
- NEEDS-CLARIFICATION: Are saved searches intended to be user-created or system-suggested?
- NEEDS-CLARIFICATION: Is the `capture-attachment` and `working-attachment` result kind used
  in practice, or are those defensive guards?
- NEEDS-CLARIFICATION: Should the "Recency-broken" sort label be a temporary placeholder name?
