# Research: Add Responsive Design To Surface UI

## Decision: One shared breakpoint scale as CSS custom properties in `layout.css`

**Rationale**: The codebase already centralizes type, spacing, density, and
theme as CSS custom properties in `surface/src/routes/layout.css`. Breakpoints
are the missing token family. Today the same "narrow" idea is encoded as four
unrelated pixel values (520/760/820/860/980). A single scale (phone and tablet
thresholds) defined once and referenced everywhere removes that drift and makes
the collapse behavior predictable across every view.

**Chosen thresholds** (from user-confirmed targets):
- Phone: up to ~480px
- Tablet: ~481-1024px
- Desktop: above 1024px

**Alternatives considered**:
- Per-component bespoke breakpoints (status quo): rejected; that is exactly the
  inconsistency this modification removes.
- Tailwind's default `sm/md/lg` utility breakpoints only: usable for utility
  classes in `.svelte` markup, but the bulk of layout lives in plain CSS files
  (`components.css`, `home.css`, `search.css`), which need custom-property
  thresholds. Decision: define the canonical values as CSS variables and, where
  Tailwind utilities are used in markup, keep them aligned to the same values.

## Decision: Plain CSS media queries, no new dependencies

**Rationale**: Tailwind v4 (`^4.2.2`) plus standard CSS media queries cover
breakpoint and `pointer: coarse` detection completely. Adding a JS-driven
responsive library would add a dependency, runtime cost, and a constitution
risk for no benefit. Constitution P1 keeps web source TypeScript; CSS and
`.svelte` files satisfy this with no JS added.

**Alternatives considered**:
- JS `matchMedia`-driven layout switching: the layout already uses `matchMedia`
  for theme only. For layout, CSS media queries are simpler, avoid hydration
  flashes, and need no state. Rejected except where a structural
  DOM change is unavoidable (the split-pane collapse, below).

## Decision: Split-pane collapse via responsive markup in `WorkbenchShell.svelte`

**Rationale**: The split is currently `wb.isSplit ? 'w-1/2' : 'w-full'`
hardcoded at `WorkbenchShell.svelte:142-148`. Two reading panes at phone width
are unusable. Below the tablet threshold the shell should render the focused
pane full width while keeping `wb.isSplit` state intact (so resizing back to
desktop restores the two-pane view without losing context). This is the one
place a CSS-only solution is awkward, because both panes are in the DOM; the
cleanest approach is responsive width classes (hide/full-width the non-focused
pane via a media query) so no workbench state or logic changes.

**Alternatives considered**:
- Change `wb.panes` state on resize: rejected; mutating workbench state from a
  viewport observer risks losing the user's split context and crosses into
  logic changes. Keep state untouched; collapse is presentation only.
- Drop the second pane from the DOM with a JS resize listener: rejected as more
  complex and flash-prone than a media-query width rule.

## Decision: Touch-target minimum via a shared coarse-pointer rule

**Rationale**: No minimum tap sizing exists today. Rather than touch every
button, apply a baseline rule in the shared style layer that raises interactive
controls to a minimum tap size under `pointer: coarse` and narrow widths, so
components inherit it. Desktop (fine pointer) controls keep their current
compact sizing.

**Minimum size**: 44x44px effective tap target on coarse-pointer / narrow,
consistent with common platform touch guidance. Applied via min-height /
min-width and padding on shared control classes, gated by media query.

**Alternatives considered**:
- Resize every control individually: rejected as high-churn and error-prone.
- Inflate controls globally: rejected; would change the desktop look the
  existing design intends.

## Decision: Migrate existing ad-hoc breakpoints, guarded by desktop snapshots

**Rationale**: The existing collapse behavior (search 860, home 980, shell 760,
editor 820, settings drawer 520) is intentional and works at desktop. Migrating
them to the shared tokens risks shifting a layout. Capture desktop e2e
snapshots first as a regression baseline, then realign, then confirm the
snapshots are unchanged at >1024px.

**Alternatives considered**:
- Leave existing breakpoints untouched and only add new ones: rejected; that
  perpetuates the inconsistency the modification exists to fix. The snapshot
  guard makes safe migration cheap.

## Decision: Accessibility stays part of the UI contract

**Rationale**: The 010 spec's accessibility requirements (visible labels, text
status, keyboard coverage, color-not-alone) continue to apply. Responsive
collapse must not hide primary actions from keyboard or screen-reader users; a
collapsed pane's content must remain reachable through existing controls.
