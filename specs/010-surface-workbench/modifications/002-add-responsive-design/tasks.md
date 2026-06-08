# Tasks: Add Responsive Design To Surface UI

**Input**: Design documents from `specs/010-surface-workbench/modifications/002-add-responsive-design/`

**Prerequisites**: `plan.md`, `modification-spec.md`, `research.md`, `data-model.md`, `contracts/responsive-layout.md`, `quickstart.md`

**Tests**: Required by the modification spec and constitution P5. Add desktop
regression snapshots before migration; add phone/tablet viewport e2e before or
alongside each behavioral change.

**Organization**: Tasks are grouped by phase so each increment can be
implemented and verified independently.

## Format: `[ID] [P?] Description`

- **[P]**: Can run in parallel (touches different files, no dependency on
  incomplete tasks)
- Every task includes exact file paths

---

## Phase 1: Setup & Baseline (Shared Context)

**Purpose**: Confirm current layout seams and lock a desktop regression baseline
before changing anything.

- [X] T001 Review current responsive state and split rendering in `surface/src/components/workbench/WorkbenchShell.svelte` (lines 142-148) and `surface/src/lib/state/workbench.svelte.ts` (`panes`, `isSplit`, `focusedPane`) without changing state shape
- [X] T002 [P] Inventory existing ad-hoc media queries to migrate: `surface/src/lib/styles/components.css` (760, 520), `surface/src/components/search/search.css` (860), `surface/src/components/home/home.css` (980), `surface/src/components/editor/EditorPane.svelte` (820)
- [X] T003 Add a desktop (1280px) Playwright regression spec to `surface/e2e/` capturing baseline layout snapshots for home, library/search, workbench split, tasks, and an open overlay (run before any migration)

---

## Phase 2: Foundation (Shared Primitives)

**Purpose**: Establish the single breakpoint scale and touch-target rule that
every later task depends on.

- [X] T004 Add `--bp-phone: 480px` and `--bp-tablet: 1024px` breakpoint tokens to the `:root` token block in `surface/src/routes/layout.css`
- [X] T005 Add a shared touch-target rule (min 44x44px effective tap target under `@media (pointer: coarse)` and narrow widths) to interactive control classes in `surface/src/lib/styles/components.css`; gate it so fine-pointer desktop sizing is unchanged

---

## Phase 3: Split-Pane Collapse (Highest Value / Risk)

**Purpose**: Deliver the core single-pane collapse guarantee (contract G1).

- [X] T006 Add a phone-width (390px) Playwright e2e to `surface/e2e/` asserting that with `isSplit` true exactly one pane renders and no two panes are side by side (write before implementation)
- [X] T007 Update `surface/src/components/workbench/WorkbenchShell.svelte` so at `<= --bp-tablet` the focused pane renders full width and the non-focused pane is not shown side by side, leaving `wb.panes`/`wb.isSplit` state untouched
- [X] T008 Verify pane chrome controls (title, close, split) remain reachable at narrow widths in `surface/src/components/workbench/PaneContainer.svelte`; adjust pane header layout if clipped

---

## Phase 4: Migrate Existing Breakpoints Onto Shared Scale

**Purpose**: Remove breakpoint drift; preserve desktop behavior (contract G5).

- [X] T009 [P] Realign `.shell` (760) and `.settings-drawer` (520) media queries in `surface/src/lib/styles/components.css` to reference the shared tokens
- [X] T010 [P] Realign the search grid breakpoint (860) in `surface/src/components/search/search.css` to the shared tablet token
- [X] T011 [P] Realign the home grid breakpoint (980) in `surface/src/components/home/home.css` to the shared tablet token
- [X] T012 [P] Realign the editor status breakpoint (820) in `surface/src/components/editor/EditorPane.svelte` to the shared tablet token
- [X] T013 Re-run the desktop (1280px) regression spec from T003 and confirm snapshots are unchanged after migration

---

## Phase 5: Close Zero-Coverage Views (Cross-Feature, CSS/Layout Only)

**Purpose**: Reflow the views that have no responsive rules today (contract G4).
Cross-feature files (002/006/013) are limited to CSS/layout, no logic changes.

- [X] T014 [P] Add responsive stacking/reflow to the tasks view in `surface/src/components/tasks/TasksView.svelte` (and `surface/src/components/process/process.css` if the triage grid overflows) at phone width [006-tasks-triage]
- [X] T015 [P] Add responsive layout to inbox action rows in `surface/src/components/inbox/ActionRow.svelte` so actions wrap/stack at phone width [002-capture-inbox]
- [X] T016 [P] Add responsive sizing to overlays so they go full-width and scroll within the viewport at phone width: `surface/src/components/overlays/CommandPalette.svelte`, `QuickCapture.svelte`, `Settings.svelte`, `NewTask.svelte`, `FileUpload.svelte`
- [X] T017 [P] Confirm reading rails reflow/stack at narrow widths: `surface/src/components/reading/AttachmentRail.svelte`, `RelatedRail.svelte`, and toast position in `surface/src/components/ui/Toast.svelte`
- [X] T018 [P] Confirm shell navigation and capture/command-palette entry points stay reachable at phone width in `surface/src/components/shell/AppShell.svelte` and `NavBtn.svelte`; verify `PwaNotice.svelte` is usable at phone width [013-surface-pwa]

---

## Phase 6: Verification & Validation

**Purpose**: Prove the contract guarantees and the desktop regression.

- [X] T019 Add tablet-width (820px) Playwright e2e to `surface/e2e/` covering collapse threshold behavior and overlay usability
- [X] T020 Add a touch-target assertion (coarse pointer / narrow) verifying audited controls meet >= 44x44px; configure a coarse-pointer project in `surface/playwright.config.ts` if needed
- [X] T021 Run full validation: `cd surface && bun run check`, `cd surface && bun run lint`, `cd surface && bun run test:e2e` (all green)

---

## Implementation Notes (deviations from the literal task text)

All 21 tasks are complete. A few were implemented differently than the original
wording; recorded here for honesty:

- **T004**: Breakpoints are defined as `--breakpoint-phone: 30rem` and
  `--breakpoint-tablet: 64rem` in a Tailwind v4 `@theme` block in `layout.css`
  (not `:root --bp-*`). `@theme` is required so the values generate Tailwind's
  `tablet:` / `max-tablet:` responsive variants used in markup. Confirmed via
  Context7 (Tailwind v4 docs).
- **T009-T012**: Plain-CSS media queries use literal `64rem` / `30rem` with a
  comment pointing to the `@theme` tokens, because CSS does not allow `var()`
  inside `@media` conditions. Range syntax `(width < 64rem)` pairs exactly with
  Tailwind's `(width >= 64rem)` `tablet:` variant (no boundary double-apply).
  This collapses the five prior ad-hoc breakpoints (520/760/820/860/980) to two.
- **T003 / T013 (desktop regression)**: Implemented as a structural assertion
  (panes are side-by-side at 1280px, same top edge) inside
  `e2e/responsive.e2e.ts` rather than committed pixel snapshots, which are
  brittle across machines/fonts. The same test then resizes to phone and asserts
  the panes restack, proving the collapse and that desktop layout is preserved.
- **T006 / T019 / T020 (e2e)**: All live in `e2e/responsive.e2e.ts`. No
  `playwright.config.ts` change was needed; the touch test uses
  `test.use({ viewport, isMobile, hasTouch })` (Chromium reports `pointer:
  coarse`). G1 is validated by the desktop->phone resize rather than driving a
  split at phone width directly.
- **T016 (overlays)**: Already responsive (`.qcap`, `.ntask`, `.palette`,
  `.settings-drawer` use `min(...)`/clamp and a phone media query). The only
  markup fix needed was the inline "New working doc" dialog in
  `WorkbenchShell.svelte` (`w-96` -> `mx-4 w-full max-w-[24rem]`). Touch sizing
  is inherited from the shared `.btn` coarse-pointer rule.
- **T017 (reading rails)**: Phone screenshot review revealed a real gap that the
  bounding-box tests missed: `.doc-content` is `flex-direction: row`, so the
  document body and the (inline-width, resizable) attachment rail sat side by
  side even at 390px, halving the body. Fixed in `components.css`: below the
  tablet breakpoint `.doc-content` stacks vertically and the expanded rail spans
  full width (overriding its desktop inline width with `!important`, resize
  handle hidden). `.related-list` already reflows via `auto-fill minmax(...)`.
- **T014 (tasks view)**: No new CSS required; task rows use `minmax(0, 1fr)`
  grids that reflow, and the new-task button inherits the shared touch-target
  rule. Now verified by an actual phone-width e2e (long task title wraps, no
  horizontal overflow) and screenshot, not inference.
- **Cross-feature verification**: `e2e/responsive.e2e.ts` exercises the
  cross-feature views the scope committed to at phone width: tasks (006),
  library/search (010), and triage / ProcessMode (006), each asserting no
  horizontal overflow. Screenshots of split, tasks, and triage at phone width
  were visually reviewed.
- **T008 (pane chrome)**: No change needed; the pane header (title + close)
  remains visible at the top of each stacked pane.

**Verification result**: `bun run build`, `bun run check` (0 errors),
`bun run lint` (prettier + eslint clean), `bun run test:unit` (51 passed), and
`bun run test:e2e` (43 passed, including 7 new responsive specs) all green.

## Dependencies & Ordering

- Phase 2 (T004-T005) blocks Phases 3-5 (everything references the shared tokens).
- T003 (baseline snapshots) must precede T013 (regression confirm) and any
  migration in Phase 4.
- T006 (failing phone e2e) precedes T007 (split collapse implementation).
- Phase 5 tasks are mutually parallel ([P]) once Phase 2 lands.
- Phase 6 runs last.

## Summary

**Total tasks**: 21 across 6 phases.
**Parallel opportunities**: T009-T012 (breakpoint migration) and T014-T018
(zero-coverage views) once foundation tokens exist.
**Breaking changes**: None (presentation only).
**Migration required**: None (no data/schema/preference change).

**Success Criteria**:
- One shared breakpoint scale; no component defines its own phone/tablet value.
- Workbench split collapses to a single pane at `<= --bp-tablet` (G1).
- Primary actions reachable at every breakpoint (G2).
- Touch targets >= 44x44px under coarse pointer / narrow (G3).
- Tasks, inbox, overlays reflow without horizontal overflow at phone (G4).
- Desktop e2e snapshots unchanged (G5).
- `bun run check`, `bun run lint`, and e2e all green (constitution P5).
