# Implementation Plan: Add Responsive Design To Surface UI

**Branch**: `010-mod-002-add-responsive-design` | **Date**: 2026-06-08 | **Spec**: [modification-spec.md](./modification-spec.md)

**Input**: Modification specification from `specs/010-surface-workbench/modifications/002-add-responsive-design/modification-spec.md`

## Summary

Make the Surface SPA responsive across phone (~375-480px), tablet (~768-1024px),
and desktop (>1024px). Introduce a shared breakpoint scale as design tokens,
minimum touch-target sizing through the shared style layer, single-pane collapse
for the workbench split below the tablet threshold, and per-view responsive
rules for views that currently have none (tasks, inbox, overlays). Migrate the
existing ad-hoc breakpoints onto the shared scale, guarded by desktop regression
snapshots so >1024px layout is provably unchanged. Presentation only: no spine
API, schema, persisted-preference, or dependency changes.

## Technical Context

**Language/Version**: TypeScript with Svelte `^5.55.2` and SvelteKit `^2.57.0` in
the static Surface SPA. Styling via Tailwind CSS `^4.2.2` plus plain CSS files.

**Primary Dependencies**: Tailwind v4 (already present), the existing CSS custom
property token system in `surface/src/routes/layout.css`, and the shared style
layer `surface/src/lib/styles/components.css`. No new dependencies.

**Storage**: None. No database or browser-persisted state change. Workbench split
state is read, never mutated.

**Testing**: Playwright e2e at named viewport widths and pointer types via
`surface/playwright.config.ts` and `surface/e2e/`. Plus `cd surface && bun run check`
and `cd surface && bun run lint`.

**Target Platform**: Browser-based SvelteKit static SPA served by spine, across
phone, tablet, and desktop viewports, including the `013-surface-pwa` installable
mobile surface.

**Project Type**: Monorepo web application UI modification. Anchored in `surface/`
under feature 010; cross-feature reach into views owned by 002, 006, 013 (CSS /
layout only, user-approved).

**Performance Goals**: No measurable layout-shift or interaction-latency
regression. Collapse is CSS-driven (no JS resize observers), so no extra runtime
cost on desktop.

## Constitution Check

- **P1 (TypeScript web source)**: satisfied; only CSS and `.svelte` files change,
  no JS added.
- **P5 (tests accompany features)**: viewport e2e added for each breakpoint plus
  a desktop regression baseline.
- **P6 (no em dashes)**: authored prose uses hyphens/colons.
- **No new dependencies**: Tailwind v4 covers breakpoints and `pointer: coarse`.

## Approach

### Phase A: Foundation (shared primitives)
1. Add `--bp-phone` (480px) and `--bp-tablet` (1024px) tokens to `layout.css`.
2. Add a shared touch-target rule (min 44x44px under `pointer: coarse` / narrow)
   to `components.css` so controls inherit it.
3. Capture desktop (1280px) e2e snapshots as the regression baseline before any
   migration.

### Phase B: Split-pane collapse (highest value/risk)
4. In `WorkbenchShell.svelte`, render the focused pane full width at
   `<= --bp-tablet` while leaving `wb.panes` / `wb.isSplit` state untouched.
5. Verify pane chrome controls (close, split, title) remain reachable in
   `PaneContainer.svelte`.

### Phase C: Migrate existing breakpoints onto the shared scale
6. Realign shell (760), settings drawer (520), search (860), home (980), editor
   (820) to the shared tokens, preserving their collapse intent. Confirm desktop
   snapshots unchanged after each.

### Phase D: Close zero-coverage views (cross-feature, CSS only)
7. Add responsive rules to tasks (`TasksView.svelte`), inbox
   (`ActionRow.svelte`), and overlays (`CommandPalette`, `QuickCapture`,
   `Settings`, `NewTask`, `FileUpload`) so they stack/reflow at phone width.
8. Confirm reading rails (`AttachmentRail`, `RelatedRail`) and toast position
   behave at narrow widths.

### Phase E: Verification
9. Playwright e2e: phone (390px), tablet (820px), desktop (1280px) per the
   contract verification matrix. Touch-target assertions under coarse pointer.
10. `bun run check`, `bun run lint`, full e2e green.

## Files In Scope

**Feature 010 (anchor)**: `routes/layout.css`, `lib/styles/components.css`,
`components/workbench/WorkbenchShell.svelte`, `components/workbench/PaneContainer.svelte`,
`components/shell/{AppShell,NavBtn}.svelte`, `components/reading/*`,
`components/home/*`, `components/search/*`, `components/editor/*`,
`components/overlays/*`, `components/ui/Toast.svelte`.

**Cross-feature (CSS/layout only)**: `components/inbox/ActionRow.svelte` (002),
`components/tasks/TasksView.svelte` + `components/process/*` (006),
`components/shell/PwaNotice.svelte` (013).

**Tests**: `surface/e2e/` (new viewport specs), `surface/playwright.config.ts`
(pointer/viewport projects if needed).

## Risks (from impact-analysis.md)

| Risk | Mitigation |
|------|------------|
| Breakpoint migration shifts a desktop layout | Desktop snapshot regression guard |
| Split-collapse hides second pane content | Keep focused pane full width; preserve controls; phone e2e |
| Touch sizing inflates desktop controls | Gate behind coarse-pointer / narrow only |
| Cross-feature edits drift beyond layout | Restrict 002/006/013 edits to CSS/layout, no logic |

## Out of Scope

Visual redesign, themes, gestures, native packaging, SSR. See modification-spec
Out of Scope.
