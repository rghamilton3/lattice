# Modification Spec: Add Responsive Design To Surface UI

**Original Feature**: [010-surface-workbench](../../spec.md)
**Modification ID**: 010-mod-002
**Branch**: `010-mod-002-add-responsive-design`
**Created**: 2026-06-08
**Status**: Draft

## Input

User description: "add responsive design to surface UI"

**Scope decision (confirmed with user)**: Cross-feature. The work spans the
entire Surface SPA, not only feature 010. It deliberately reaches into views
owned by `002-capture-inbox`, `006-tasks-triage`, and `013-surface-pwa`. This
modification is anchored under feature 010 because 010 owns the shared style
layer (`surface/src/lib/styles/`), the design tokens (`surface/src/routes/layout.css`),
and the SPA shell that all other views render inside. The cross-feature reach is
an intentional, user-approved exception to the 010 spec's "do not modify other
features" note, recorded here so the boundary is explicit rather than silent.

**Target breakpoints (confirmed)**: Phone (~375-480px), Tablet (~768-1024px),
Desktop (>1024px).

**Definition of done (confirmed)**: At every target breakpoint the UI must
satisfy all three:
1. **Touch-target sizing**: interactive controls meet a minimum tap size on
   coarse-pointer / narrow viewports.
2. **Primary actions reachable**: capture, command palette, navigation, and
   editor save/delete remain visible and operable (never clipped or hidden
   behind overflow).
3. **Single-pane collapse on narrow**: split / two-pane layouts collapse to a
   single stacked pane below the tablet threshold rather than squeezing both
   side by side.

## Why Modify?

The Surface SPA today is desktop-first. Responsive behavior exists, but it is
partial, ad-hoc, and inconsistent:

- The viewport meta tag is correct (`width=device-width, initial-scale=1` in
  `surface/src/app.html`), so the foundation for responsive layout is present.
- A handful of components carry one-off media queries at unrelated breakpoints
  (`520px`, `760px`, `820px`, `860px`, `980px`) with no shared scale. The same
  conceptual "narrow" boundary is expressed as four different pixel values.
- The workbench split view hardcodes `w-1/2` for both panes
  (`surface/src/components/workbench/WorkbenchShell.svelte:142-148`) with no
  collapse, so on a phone two reading panes are crushed to unusable widths.
- There is no minimum touch-target sizing anywhere. Controls rely on small
  paddings (e.g. `1px 6px`, `3px 8px`) that are fine for a mouse but too small
  for reliable finger taps.
- Whole views have no responsive rules at all: tasks (`TasksView.svelte`),
  inbox (`ActionRow.svelte`), and most overlays (`CommandPalette`,
  `QuickCapture`, `Settings`, `NewTask`, `FileUpload`).

The original 010 spec already promises responsive behavior. User Story 1,
Acceptance Scenario 4 states: "Given the user is on a narrow viewport, When
they use the core navigation and overlays, Then controls remain reachable
without horizontal page-level scrolling or hidden primary actions." The
`013-surface-pwa` feature makes installable mobile use a real target. This
modification closes the gap between that promise and the current desktop-first
reality, and extends it consistently across every Surface view.

## What's Changing?

### Added

- **A shared breakpoint scale** as design tokens in `layout.css`, alongside the
  existing type/spacing/density tokens. A single source of truth for the phone
  and tablet thresholds so every view collapses at the same widths.
- **Touch-target sizing rules** that raise interactive controls to a minimum tap
  size under coarse-pointer / narrow conditions, applied through the shared
  style layer so individual components inherit it.
- **Responsive single-pane collapse** in the workbench: below the tablet
  threshold the two-pane split renders one pane (the focused pane) full width,
  with the existing close/split controls preserved.
- **Per-view responsive rules** for the views that currently have none: tasks,
  inbox action rows, and the capture/command/settings overlays, so they stack
  and reflow instead of overflowing.

### Modified

- **Existing ad-hoc media queries** are migrated to reference the shared
  breakpoint tokens so the phone/tablet boundaries are consistent. Existing
  collapse behavior (search grid, home grid, shell rows, settings drawer) is
  preserved but realigned to the shared scale.
- **The SPA shell** (`AppShell.svelte`, `.shell` in `components.css`) keeps its
  current structure but ensures primary navigation and the capture / command
  palette entry points stay reachable at phone width rather than being pushed
  off-screen.

### Explicitly NOT changing

- No spine API, REST contract, or database changes. This is presentation only.
- No persisted-preference shape changes. The existing `density` preference is
  orthogonal to viewport breakpoints and is left as-is (see Data Model: N/A).
- No new runtime dependencies. Tailwind v4 plus plain CSS media queries cover
  everything needed.
- No change to theme, focus mode, posture, or Vim-mode behavior.

## Backward Compatibility

This is additive and presentation-only. Desktop layout (>1024px) is the current
behavior and is preserved unchanged: every new rule is gated behind a
narrower-than-desktop media query or a coarse-pointer condition. No existing
keyboard flow, deep link, or persisted preference is altered, so there is no
migration and no breaking change for existing users or saved sessions.

## Out of Scope

- Reworking the visual design language, themes, or color tokens.
- Mobile-specific gestures (swipe, pull-to-refresh) beyond reachable tap targets.
- Native app packaging beyond what `013-surface-pwa` already provides.
- Server-side rendering or adaptive payloads; this remains a static SPA.

## Acceptance Scenarios

1. **Given** the user opens Surface on a phone-width viewport (375-480px),
   **When** the workbench loads in split (two-pane) state, **Then** it renders a
   single full-width pane with the other pane reachable via existing controls,
   and no two panes are shown side by side.
2. **Given** any target breakpoint (phone, tablet, desktop), **When** the page
   renders, **Then** capture, command palette, primary navigation, and editor
   save/delete are visible and operable without being clipped or requiring
   page-level horizontal scrolling to reach.
3. **Given** a coarse-pointer / phone or tablet viewport, **When** the user taps
   interactive controls (nav buttons, action rows, overlay buttons), **Then**
   each control meets the minimum tap-target size.
4. **Given** the tasks view, inbox action rows, and capture/command/settings
   overlays, **When** viewed at phone width, **Then** content stacks and reflows
   within the viewport rather than overflowing horizontally.
5. **Given** a desktop viewport (>1024px), **When** the page renders, **Then**
   layout matches current behavior (regression: no visual change at desktop).

## Success Metrics

| Metric | Target | Measurement |
|--------|--------|-------------|
| Breakpoint consistency | One shared scale | No component defines its own phone/tablet pixel value; all reference tokens |
| Split collapse | 100% | Two-pane split renders single pane at <= tablet threshold |
| Touch targets | Min size met | Audited controls meet minimum tap size at coarse-pointer/narrow |
| Desktop regression | 0 changes | Desktop e2e snapshots unchanged |
| Cross-view coverage | All target views | tasks, inbox, overlays, shell, panes pass viewport e2e |

## Metadata

**Workflow**: Modify (Impact-Analysis-First)
**Original Feature**: Feature 010-surface-workbench
**Modification ID**: 010-mod-002
**Smart Integration**: SpecSwarm (tech-stack + constitution enforcement)
