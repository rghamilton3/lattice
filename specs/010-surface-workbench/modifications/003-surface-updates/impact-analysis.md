# Impact Analysis: Surface Updates (Keyword-Only Indicator, Attachment Descriptions, Resurfacing Defaults & Cluster Route)

**Feature**: 010-surface-workbench (anchor; cross-feature scope into 016, 017, 018)
**Modification**: 010-mod-003 - surface updates
**Analysis Date**: 2026-06-10
**Analyst**: SpecSwarm /ss:modify

---

## Proposed Changes

Three Surface UI changes requested:

1. **"Keyword-only" indicator driven by endpoint/breaker state; remove the fast/deep toggle.**
2. **Attachment view**: show extraction state; render the machine-seeded description in an
   editable field; mark confirmed on user edit.
3. **Resurfacing panel on landing** (visible on arrival, hidden once inside a doc;
   positive-dismissal action row; no counts, no streaks). **Cluster-as-view**: `/cluster/:id`
   lists a cluster; "show cluster" on any doc opens it.

**Change categories**:
- Functional changes: status-driven degraded indicator; attachment description editing;
  feature flag default flips; URL-addressable cluster view.
- Data model changes: none (all spine schema/endpoints already shipped in 016/017/018).
- API / contract changes: none breaking. One additive spine route (`GET /cluster/:id`
  SPA-shell fallback). Surface `StatusResponse` type catches up to fields spine already
  returns.
- UI changes: LibraryView banner source, AppShell status pill, AttachmentRail extraction
  state + description editor, flag defaults, new SvelteKit route.

---

## Current State (grounded audit, 2026-06-10)

### 1. Keyword-only indicator / fast-deep toggle (016)

| Item | State |
|------|-------|
| Fast/deep toggle | **Already removed.** No `deep` param, no toggle UI, no `searchDeep` path remain (`grep` clean across `surface/src` and `spine/src`). |
| Per-search indicator | **Exists.** `LibraryView.svelte:317-325` renders a "Keyword-only" banner when the search response has `degraded: true`. |
| Breaker state exposure | **Spine done, surface not consuming.** `/api/status` returns `search_degraded`, `needs_embedding`, `index_failures` (`spine/src/routes/status.ts:8-34`), but surface's `StatusResponse` (`surface/src/lib/api/status.ts`) omits all three and no UI reads them. |
| Status polling | **Exists.** `AppShell.svelte:47-53` polls `/api/status` every 30s via TanStack Query. |

**Gap**: the indicator only appears *after* a degraded search response. It is not driven by
the endpoint/breaker state, so a user opening the library during an outage sees no warning
until results land, and nothing outside the library view ever indicates degraded search.

### 2. Attachment view (017)

| Item | State |
|------|-------|
| Spine extraction status | **Done.** `extraction_status` ('pending'/'done'/'failed'/'dark') returned by all attachment list/upload endpoints (`spine/src/routes/attachments.ts:25-121`, `working.ts:155-246`). |
| Spine description endpoints | **Done.** GET/PATCH `/api/captures/:id/attachments/:attId/description` and working-doc variants; PATCH accepts `{ final_text?, confirmed? }`, reindexes on text change (`attachments.ts:223-356`, `working.ts:342-470`). |
| Surface types | **Missing.** `BaseAttachment` (`surface/src/lib/types.ts:163-170`) has no `extraction_status`; no `AttachmentDescription` type. |
| Surface API client | **Missing.** `surface/src/lib/api/attachments.ts` has no description fetch/patch functions. |
| Surface UI | **Missing.** `AttachmentRail.svelte` shows filename/size/delete only; no extraction state, no description display or editing anywhere. |

### 3. Resurfacing & clustering (018)

| Item | State |
|------|-------|
| Spine endpoints | **Done.** `GET /api/resurfaced`, `POST /api/resurfaced/:id/dismiss`, `GET /api/cluster/:id`, `GET /api/cluster/doc/:kind/:target_id` all implemented and committed. |
| Resurfaced panel | **Done.** `Resurfaced.svelte` on home: positive-dismissal action row (Useful / Not now / Don't resurface), no counts, no streaks, optimistic dismissal, home-only (unmounts when pane 0 leaves `home`). |
| Cluster pane view | **Done.** `ClusterView.svelte` + "Cluster" button on docs (`ReadingPane.svelte:404-411`) opening in the other pane. |
| Feature flags | **Stale.** `resurfacing` and `clusters` default `false` with a stale TODO claiming the backing endpoints don't exist (`workbench.svelte.ts:80-89`). They shipped in commit 1b9b811. With defaults off, none of the shipped UI renders. |
| `/cluster/:id` URL | **Missing.** 018 spec (spec.md:78) promises "reachable directly via `/cluster/:id`", but the SPA has only the root route with `?ref=` / `?view=` query params. Spine's static plugin has no SPA fallback, so a hard load of `/cluster/42` 404s (the service worker only rescues repeat PWA visits, `service-worker.ts:58-74`). |

---

## Affected Components

### Direct

| Component | File | Impact | Notes |
|-----------|------|--------|-------|
| Status API type | `surface/src/lib/api/status.ts` | Low | Additive fields, matches what spine already sends |
| Library view | `surface/src/components/home/LibraryView.svelte` | Medium | Banner driven by status OR response `degraded` |
| App shell | `surface/src/components/shell/AppShell.svelte` | Low | Compact "Keyword-only" pill in toolbar status area |
| Types | `surface/src/lib/types.ts` | Low | `ExtractionStatus`, `extraction_status`, `AttachmentDescription` |
| Attachments API | `surface/src/lib/api/attachments.ts` | Medium | Description GET/PATCH for capture + working |
| Attachment rail | `surface/src/components/reading/AttachmentRail.svelte` | High | Extraction badge per row; editable description for `dark` items |
| Workbench state | `surface/src/lib/state/workbench.svelte.ts` | Low | Flag defaults `false` → `true`; fix stale comment |
| SPA routes | `surface/src/routes/cluster/[id]/+page.svelte` (new) | Medium | Opens cluster in pane 0, renders WorkbenchShell |
| Spine app | `spine/src/app.ts` | Low | Targeted `GET /cluster/:id` → serve SPA `index.html` |

### Indirect

| Component | Impact | Notes |
|-----------|--------|-------|
| `Resurfaced.svelte`, `ClusterView.svelte`, ReadingPane "Cluster" button | Behavioral | Become visible by default once flags flip; code unchanged |
| Env overrides `PUBLIC_LATTICE_FEATURE_RESURFACING/CLUSTERS` | Behavioral | Still honored; semantics change from opt-in to opt-out |
| Service worker shell fallback | None | Already serves cached shell for unknown routes; new spine fallback covers first loads |
| TanStack Query status cache | None | LibraryView reuses `statusKeys.all()`; deduped with AppShell's poll |

---

## Breaking Changes Assessment

### Breaking Changes Identified: No

- All spine endpoints consumed already exist; no contract changes.
- `StatusResponse` additions are additive (spine already returns the fields).
- Flag default flips change *visible behavior* but not contracts; users who set
  `PUBLIC_LATTICE_FEATURE_*=false` keep their override.
- New spine route `/cluster/:id` is net-new; cannot collide with `/api/*` or existing
  static assets.
- 018 spec F10 says both flags "default to `false` in production". This modification
  deliberately supersedes that line (the flags were off only because the endpoints had
  not shipped); recorded here as an intentional spec delta.

---

## Backward Compatibility Strategy

**Approach**: additive-only. No compatibility layer needed.

- Indicator: keep the per-response `degraded` signal and OR it with status-driven
  `search_degraded`, so behavior is a strict superset of today's.
- Attachments: new UI reads new fields; old data (`pending` defaults from migration 013)
  renders correctly.
- Cluster route: pure addition; existing `?ref=` deep links untouched.

---

## Risk Assessment

### Risk Level: Low

| Risk | Likelihood | Impact | Mitigation |
|------|------------|--------|------------|
| Description editor races automated re-description (unconfirmed `dark` items may be superseded) | Low | Low | PATCH targets the head row server-side; on save, invalidate the description query and re-render returned row |
| 409 when PATCHing a non-`dark` attachment (state changed under the user) | Low | Low | Editor only rendered for `dark`; surface 409/404 as inline error, invalidate list |
| Flag flip surfaces resurfacing panel for users who never opted in | Medium | Low | Panel is dismissible, posture `quiet` still hides it, env override remains |
| Spine `/cluster/:id` fallback shadows a future real asset path | Low | Low | Targeted single route (not a catch-all); registered only when `surfaceBuild` exists |
| `needs_embedding`/`index_failures` unused fields drift | Low | Low | Typed now, consumed by AppShell pill tooltip; cheap to keep accurate |

**Overall Risk Score**: 2/10

---

## Testing Requirements

- **Spine**: new test for `GET /cluster/:id` serving the SPA shell (and `/api/cluster/:id`
  still returning JSON). Existing suites must stay green (`just test`).
- **Surface**: `just check` (tsc) and `just lint`; existing vitest suites
  (e.g. `deeplink.test.ts`) stay green. Manual flows: degraded banner with endpoint down,
  description edit on a `dark` attachment, `/cluster/:id` hard load, resurfaced dismissal.

---

## Rollout Strategy

Single-phase: all changes ship together on this branch. Rollback is a plain revert
(no data migration, no contract change). Feature flags act as the kill switch for the
resurfacing/cluster portion (`PUBLIC_LATTICE_FEATURE_*=false`).

---

## Recommendations

1. Proceed - all heavy lifting (schema, endpoints, background passes) already shipped;
   this closes the surface gaps and two spec promises (016 status indicator, 018
   `/cluster/:id` reachability).
2. Keep the spine fallback targeted to `/cluster/:id` rather than a global SPA catch-all,
   preserving 404 semantics for genuinely unknown paths.
3. Record the F10 flag-default delta in the 018 spec history when this merges.

**Proceed with Modification**: Yes

---

## Tech Stack Compliance

**Tech Stack File**: .specswarm/tech-stack.md
**Validation Status**: Compliant - no new dependencies; uses existing Elysia, SvelteKit
(runes), Tailwind-adjacent component CSS, TanStack Query patterns.

---

## Metadata

**Workflow**: Modify (Impact-Analysis-First)
**Created By**: SpecSwarm /ss:modify
**Branch**: `worktree-feat+surface-updates`
