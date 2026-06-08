# Impact Analysis: Add Responsive Design To Surface UI

**Feature**: 010-surface-workbench (anchor; cross-feature scope)
**Modification**: 010-mod-002 - add responsive design to surface UI
**Analysis Date**: 2026-06-08
**Analyst**: SpecSwarm /ss:modify

---

## Proposed Changes

Make the entire Surface SPA responsive across phone (~375-480px), tablet
(~768-1024px), and desktop (>1024px). Introduce a shared breakpoint scale,
minimum touch-target sizing, single-pane collapse for the workbench split, and
per-view responsive rules for views that currently have none.

**Change categories**:
- Functional changes: split-pane collapse behavior at narrow widths (layout
  behavior, no data/logic change).
- Data model changes: none (see Data Model: N/A).
- API / contract changes: none (presentation only).
- UI / CSS changes: shared breakpoint tokens, touch-target rules, per-view
  media queries across shell, panes, tasks, inbox, overlays.

---

## Current State (grounded audit, 2026-06-08)

Responsive behavior is **partially present and inconsistent**, not absent:

| Area | File | Current responsive behavior |
|------|------|-----------------------------|
| Viewport meta | `surface/src/app.html` | Correct: `width=device-width, initial-scale=1`. Foundation present. |
| Design tokens | `surface/src/routes/layout.css` | Type/spacing/density/theme tokens exist. **No breakpoint tokens.** |
| Shell | `surface/src/lib/styles/components.css:335` | `.shell` collapses rows at `max-width: 760px`; `min-height: 48px` nav at that width. |
| Settings drawer | `surface/src/lib/styles/components.css:637` | Full-width at `max-width: 520px`. |
| Search | `surface/src/components/search/search.css:40` | Grid -> single column at `max-width: 860px`. |
| Home | `surface/src/components/home/home.css:123` | Grid -> single column at `max-width: 980px`. |
| Editor | `surface/src/components/editor/EditorPane.svelte:493` | Status row stacks at `max-width: 820px`. |
| Workbench split | `surface/src/components/workbench/WorkbenchShell.svelte:142-148` | **Hardcoded `w-1/2` per pane; no collapse.** Core gap. |

**Gap summary**:
- Four different "narrow" breakpoints (520/760/820/860/980) with no shared scale.
- No minimum touch-target sizing anywhere.
- Split view crushes two panes at phone width.
- Tasks, inbox, and most overlays have zero responsive rules.

---

## Affected Components

### Direct (feature 010-surface-workbench)

| Component | File | Impact | Notes |
|-----------|------|--------|-------|
| Design tokens | `routes/layout.css` | High | Add shared breakpoint tokens |
| Shared styles | `lib/styles/components.css` | High | Touch-target rules; realign shell/drawer breakpoints |
| Workbench split | `components/workbench/WorkbenchShell.svelte` | High | Single-pane collapse below tablet |
| Pane container | `components/workbench/PaneContainer.svelte` | Low | Verify pane chrome controls stay reachable |
| App shell | `components/shell/AppShell.svelte`, `NavBtn.svelte` | Medium | Nav + capture/palette entry reachable at phone |
| Reading panes | `components/reading/ReadingPane.svelte`, `AttachmentRail.svelte`, `RelatedRail.svelte`, `MarkdownRenderer.svelte`, `PdfViewer.svelte` | Medium | Rails stack; rendered content reflows |
| Home | `components/home/*` (`home.css`, `HomeView`, `LibraryView`, `NowCard`, `PostureToggle`, `Resurfaced`) | Medium | Realign grid breakpoint to shared scale |
| Search | `components/search/*` (`search.css`, `Facets`, `ResultList`, `ResultRow`) | Medium | Realign breakpoint; facet reflow |
| Editor | `components/editor/EditorPane.svelte`, `VimToggle.svelte` | Medium | Realign status breakpoint; toolbar reachable |
| Overlays | `components/overlays/CommandPalette`, `Settings`, `QuickCapture`, `NewTask`, `FileUpload` | High | Add responsive sizing; full-width on phone |
| UI | `components/ui/Toast.svelte` | Low | Verify toast position on narrow |

### Cross-feature (user-approved scope reach)

| Component | File | Owning feature | Impact |
|-----------|------|----------------|--------|
| Inbox action row | `components/inbox/ActionRow.svelte` | 002-capture-inbox | Medium - no responsive rules today |
| Inbox list | `components/home/InboxList.svelte` | 002-capture-inbox | Low - reflow within home grid |
| Tasks view | `components/tasks/TasksView.svelte` | 006-tasks-triage | Medium - no responsive rules today |
| Process / triage | `components/process/ProcessMode.svelte`, `process.css` | 006-tasks-triage | Medium - only reduced-motion query today |
| PWA notice/runtime | `components/shell/PwaNotice.svelte`, `lib/state/pwa.svelte` | 013-surface-pwa | Low - confirm install/notice usable at phone |

**Total direct (010)**: ~18 files. **Total cross-feature**: ~5 files.

---

## Breaking Changes Assessment

**Breaking changes identified: No.**

All changes are additive CSS gated behind narrower-than-desktop media queries or
coarse-pointer conditions. Desktop (>1024px) behavior is unchanged. No API,
schema, persisted-preference, or keyboard-flow change. Existing saved sessions
load identically.

---

## Backward Compatibility Strategy

**Approach**: Progressive enhancement, desktop-preserving.

1. Define shared breakpoint tokens without changing desktop defaults.
2. Add narrow/coarse-pointer rules only; never alter the >1024px cascade.
3. Migrate existing ad-hoc breakpoints to the shared scale, preserving their
   current collapse intent (verified by desktop regression snapshots).

No migration, no compatibility layer, no deprecation needed.

---

## Risk Assessment

**Risk level: Low-Medium.**

| Risk | Likelihood | Impact | Mitigation |
|------|------------|--------|------------|
| Realigning existing breakpoints shifts a desktop layout | Low | Medium | Desktop e2e snapshot regression before/after |
| Split-collapse hides the second pane's content | Medium | Medium | Keep focused pane full width; preserve close/split controls; e2e at phone |
| Touch-target sizing inflates desktop controls | Low | Low | Gate sizing behind coarse-pointer / narrow only |
| Cross-feature edits drift outside responsive intent | Low | Medium | Scope tasks to CSS/layout only; no logic changes in 002/006/013 files |
| Tailwind v4 token wiring for breakpoints misconfigured | Low | Low | Use plain CSS custom props + media queries; confirm with Tailwind v4 docs |

**Overall risk score**: 4/10.

---

## Testing Requirements

### Existing tests to update
- `surface/e2e/surface.e2e.ts`: existing workbench/navigation flows must still
  pass; add desktop-width assertions as the regression baseline.

### New tests required (constitution P5: features ship with tests)
- Phone-width (e.g. 390px) e2e: split state renders single pane; primary actions
  reachable; no horizontal page scroll.
- Tablet-width (e.g. 820px) e2e: collapse threshold behavior; overlays usable.
- Desktop-width (e.g. 1280px) e2e: regression - layout unchanged.
- Touch-target check at coarse-pointer/narrow for audited controls.

### Tooling
- Playwright via `playwright.config.ts`; use viewport sizing and
  `page.emulateMedia`/project configs for pointer + width.

---

## Tech Stack Compliance

**Tech-stack file**: `.specswarm/tech-stack.md`
**Constitution**: `.specswarm/constitution.md`

- P1 (TypeScript for web source): satisfied - no new JS; CSS + `.svelte` only.
- P5 (tests accompany features): satisfied via viewport e2e above.
- P6 (no em dashes): authored prose uses hyphens/colons.
- No new dependencies introduced (Tailwind v4 already present).

**Validation status**: Compliant.

---

## Recommendations

1. Land the shared breakpoint tokens + touch-target primitives first; they are
   the foundation every per-view task depends on.
2. Do the workbench split-collapse second; it is the highest-value, highest-risk
   single change and deserves dedicated e2e.
3. Migrate existing ad-hoc breakpoints with desktop snapshots as a guard before
   touching the zero-coverage views.
4. Keep cross-feature edits (002/006/013) strictly CSS/layout; no logic changes.

**Proceed with modification**: Yes.
