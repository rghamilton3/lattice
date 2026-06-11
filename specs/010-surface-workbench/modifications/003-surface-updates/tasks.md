# Tasks: 010-mod-003 Surface Updates

**Workflow**: Modify (Impact-Analysis-First)
**Status**: Active
**Created**: 2026-06-10

## Phase 1: Impact validation

- [x] T001 Impact analysis complete (impact-analysis.md); no breaking changes; risk 2/10.

## Phase 2: Compatibility layer

- [x] T002 N/A - additive-only modification, no breaking changes.

## Phase 3: Core implementation

- [x] T003 [M1] Extend `StatusResponse` with `search_degraded`, `needs_embedding`,
      `index_failures` (`surface/src/lib/api/status.ts`).
- [x] T004 [M1] LibraryView: banner driven by `searchResponse.degraded OR
      status.search_degraded`; visible before first search during an outage
      (`surface/src/components/home/LibraryView.svelte`).
- [x] T005 [M1] AppShell: compact "Keyword-only" pill in toolbar status area when
      `search_degraded` (`surface/src/components/shell/AppShell.svelte`).
- [x] T006 [M1] Verify fast/deep toggle fully absent (grep `deep`/`searchDeep` across
      surface + spine). Verification-only.
- [x] T007 [M2] Types: `ExtractionStatus`, `BaseAttachment.extraction_status`,
      `AttachmentDescription` (`surface/src/lib/types.ts`).
- [x] T008 [M2] API client: description GET/PATCH for capture + working, query keys
      (`surface/src/lib/api/attachments.ts`).
- [x] T009 [M2] AttachmentRail: extraction state badge per row; disclosure + editable
      description (seeded with machine text) for `dark` items; save PATCHes
      `{ final_text, confirmed: true }`; confirmed indicator; inline errors
      (`surface/src/components/reading/AttachmentRail.svelte`).
- [x] T010 [M3] Flag defaults `resurfacing`/`clusters` → `true`; remove stale TODO
      (`surface/src/lib/state/workbench.svelte.ts`).
- [x] T011 [M3] New route `surface/src/routes/cluster/[id]/+page.svelte` opening
      `{ kind: 'cluster', clusterId }` in pane 0 with bad-id fallback.
- [x] T012 [M3] Spine: targeted `GET /cluster/:id` SPA-shell fallback when surface build
      exists (`spine/src/app.ts`).

## Phase 4: Testing and validation

- [x] T013 Spine test: `/cluster/:id` serves HTML shell; `/api/cluster/:id` unchanged.
- [x] T014 Regression: spine 466/466 pass; surface server vitest 69/69 pass; svelte-check 0 errors; prettier + eslint + oxlint clean; production build OK. Browser-mode vitest suites (MarkdownRenderer/livePreview/selection) could not launch headless Chromium in this sandbox; they are untouched by this change.

## Phase 5: Rollout

- [x] T015 Single-phase; rollback = revert; kill switch = `PUBLIC_LATTICE_FEATURE_*`.

## Summary

Breaking changes: none. Migration: none.
