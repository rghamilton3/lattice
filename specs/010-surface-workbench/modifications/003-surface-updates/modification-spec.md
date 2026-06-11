# Modification Spec: Surface Updates

**Original Feature**: [010-surface-workbench](../../spec.md)
**Modification ID**: 010-mod-003
**Branch**: `worktree-feat+surface-updates`
**Created**: 2026-06-10
**Status**: Active
**Impact Analysis**: [impact-analysis.md](impact-analysis.md)

## Input

User description: make the following changes to the Surface UI:
- "Keyword-only" indicator driven by endpoint/breaker state. Remove the fast/deep toggle.
- Attachment view: show extraction state; render the machine-seeded description in an
  editable field; mark confirmed on user edit.
- Resurfacing panel on landing (visible on arrival, hidden once inside a doc;
  positive-dismissal action row; no counts, no streaks). Cluster-as-view: /cluster/:id
  lists a cluster; "show cluster" on any doc opens it.

**Scope decision**: Cross-feature, anchored under 010 (precedent: 010-mod-002). The work
is the Surface follow-through for spine capabilities shipped by `016-remote-inference`,
`017-attachment-extraction`, and `018-resurface-and-clustering`. One small spine touch
(SPA-shell fallback for `/cluster/:id`) is included because the 018 spec promises that URL
and the static layer cannot serve it today.

## Why Modify?

Spine shipped the backing capabilities, but the Surface either does not consume them or
hides them behind stale defaults:

- `/api/status` reports `search_degraded` (breaker state) but no UI reads it; the
  Keyword-only banner is driven only by individual search responses.
- Attachment extraction state and machine-seeded descriptions (017) are fully served but
  invisible: the rail shows only filename/size/delete, and `dark` attachments' editable
  descriptions have no UI at all.
- The resurfaced panel and cluster view (018) are implemented but dead code in practice:
  both feature flags default `false` behind a stale "endpoints don't exist yet" TODO, and
  the spec-promised `/cluster/:id` URL was never wired.

## What's Changing?

### M1 - Keyword-only indicator driven by endpoint/breaker state

**Current**: `LibraryView` shows the banner only when a search response has
`degraded: true`. The fast/deep toggle is already removed (016); this spec item is
verification-only for the toggle.

**Proposed**:
- Extend `StatusResponse` (`surface/src/lib/api/status.ts`) with `search_degraded:
  boolean`, `needs_embedding: number | null`, `index_failures: number` - fields spine
  already returns.
- `LibraryView` additionally subscribes to the existing 30s status poll (same query key,
  deduped) and shows the banner when **either** the last search response was degraded
  **or** `status.search_degraded` is true. The banner therefore appears on arrival in the
  library during an outage, before any search is run.
- `AppShell` toolbar status area gains a compact "Keyword-only" pill when
  `search_degraded` is true, so degraded search is visible from any view. Tooltip
  includes the embedding backlog when `needs_embedding > 0`.

**Breaking**: No.

### M2 - Attachment extraction state + editable description

**Current**: `AttachmentRail` rows show filename, size, delete.

**Proposed**:
- Types: `ExtractionStatus = 'pending' | 'done' | 'failed' | 'dark'`;
  `BaseAttachment.extraction_status`; `AttachmentDescription` mirroring the spine row
  (with `confirmed: boolean`).
- API client: `fetchAttachmentDescription` / `updateAttachmentDescription` for both
  capture and working variants, plus query keys.
- `AttachmentRail` per-row extraction state: `pending` ("extracting…"), `failed`,
  `dark` ("described") shown as a small badge; `done` stays unadorned (the common case).
- For `dark` attachments, a disclosure toggle reveals the description: a textarea seeded
  with the machine description (`final_text`), a save action, and a confirmed indicator.
  - GET 404 → "No description yet" (generation pending/in-flight).
  - Saving an edit PATCHes `{ final_text, confirmed: true }` - **user edit confirms the
    description** (017 semantics: confirmed rows are never overwritten by re-runs).
  - Already-confirmed descriptions remain editable (text-only PATCH); the confirmed badge
    persists.
  - 409/404 on save render an inline error and invalidate the queries.

**Breaking**: No.

### M3 - Resurfacing on by default; cluster-as-view URL

**Current**: `Resurfaced.svelte` and `ClusterView.svelte` exist and meet the brief
(positive-dismissal action row "Useful / Not now / Don't resurface"; no counts, no
streaks; home-only so it hides inside docs; "Cluster" button on docs). But
`featureFlags.resurfacing` and `featureFlags.clusters` default `false`, and there is no
`/cluster/:id` URL.

**Proposed**:
- Default both flags to `true` (env overrides keep working; posture `quiet` still hides
  the panel). Remove the stale TODO comment. This supersedes 018 F10's "default false",
  which existed only because the endpoints had not shipped.
- Default posture changes `quiet` → `standard` so the panel is actually visible on
  arrival with a fresh profile ("standard — counts + resurfaced visible"). Persisted
  preferences override; `quiet` remains the opt-out. No spec pins the previous default.
- New SvelteKit route `surface/src/routes/cluster/[id]/+page.svelte`: validates the id,
  opens `{ kind: 'cluster', clusterId }` in pane 0 (fallback home + toast on a bad id),
  renders `WorkbenchShell`. Client-side nav and PWA loads work via the existing fallback
  shell; first-load works via:
- Spine: targeted `GET /cluster/:id` serving the Surface `index.html` (registered only
  when a surface build exists, alongside the static plugin, unauthenticated like other
  shell assets). Not a global catch-all - unknown paths still 404.

**Breaking**: No.

## Backward Compatibility Strategy

Additive-only; no compatibility layer, no migration. Flag flips are reversible per-deploy
via `PUBLIC_LATTICE_FEATURE_RESURFACING` / `PUBLIC_LATTICE_FEATURE_CLUSTERS`.

## Testing Strategy

- Regression: full spine suite (`just test`), surface vitest, `just check`, `just lint`.
- New: spine test asserting `GET /cluster/42` returns the SPA shell (HTML) while
  `GET /api/cluster/42` keeps returning JSON/404.
- Manual: degraded banner on arrival with endpoint down; description edit on a `dark`
  attachment marks confirmed; `/cluster/:id` hard load; dismissal action row.

## Success Metrics

| Metric | Target |
|--------|--------|
| Keyword-only pill/banner visible during outage without running a search | Yes |
| `dark` attachment description editable; edit persists `confirmed=1` | Yes |
| Hard load of `/cluster/:id` renders the cluster member list | Yes |
| Resurfaced panel visible on arrival with default config; hidden inside docs | Yes |
| All existing tests green | 100% |

## Alternative Approaches Considered

- **Global SPA catch-all in spine** instead of a targeted `/cluster/:id` route: rejected;
  it silently turns asset 404s into HTML 200s and changes 404 semantics platform-wide.
- **`?ref=cluster:42` query-param deep link** instead of a path route: rejected; the 018
  spec explicitly promises `/cluster/:id`, and the user asked for it verbatim.
- **Status-only indicator (drop per-response `degraded`)**: rejected; the response flag is
  the ground truth for the results actually on screen, while breaker state may flip
  between poll intervals. OR-ing both is a strict superset.

## Tech Stack Compliance

Compliant - no new dependencies or patterns.

## Metadata

**Workflow**: Modify (Impact-Analysis-First)
**Created By**: SpecSwarm /ss:modify
