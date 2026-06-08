# Contract: Responsive Layout System

**Modification**: 010-mod-002
**Type**: Presentation / layout contract (no network or API surface)

This contract defines the observable, testable rules the Surface UI must satisfy
across viewports. It is verified by Playwright viewport e2e, not by a wire
protocol.

## Breakpoint scale (single source of truth)

Defined as CSS custom properties in `surface/src/routes/layout.css`:

| Token | Value | Meaning |
|-------|-------|---------|
| `--bp-phone` | `480px` | At or below: phone layout |
| `--bp-tablet` | `1024px` | At or below: tablet (and narrow desktop) layout |
| (above `--bp-tablet`) | `> 1024px` | Desktop layout (current default) |

Rules:
- No component may define its own phone/tablet pixel value. Existing ad-hoc
  breakpoints (520/760/820/860/980) are migrated to reference these tokens.
- Media queries use `max-width: var(...)` equivalents aligned to these values.
  Where Tailwind utility classes are used in markup, they align to the same
  thresholds.

## Behavioral guarantees

### G1. Single-pane collapse
- **Given** `isSplit === true` and viewport width `<= --bp-tablet`
- **Then** exactly one pane (the focused pane) renders at full width.
- **And** the other pane is not shown side by side.
- **And** `wb.panes` / `wb.isSplit` state is unchanged (resize to desktop
  restores two-pane view).

### G2. Primary actions reachable
- **At every breakpoint** (phone, tablet, desktop) the following are visible and
  operable without page-level horizontal scrolling:
  capture entry, command palette entry, primary navigation, editor save/delete.

### G3. Touch-target sizing
- **Given** a coarse-pointer or `<= --bp-tablet` viewport
- **Then** interactive controls (nav buttons, action rows, overlay buttons)
  present an effective tap target of at least `44x44px`.

### G4. Reflow, no overflow
- **At `<= --bp-phone`** the tasks view, inbox action rows, and the
  capture/command/settings overlays stack and reflow within the viewport; no
  horizontal page-level scrollbar appears.

### G5. Desktop regression
- **At `> --bp-tablet`** layout is identical to pre-modification behavior.
  Verified by desktop e2e snapshots taken before and after.

## Verification matrix

| Guarantee | Phone (390px) | Tablet (820px) | Desktop (1280px) |
|-----------|---------------|----------------|------------------|
| G1 split collapse | single pane | single pane | two panes |
| G2 actions reachable | yes | yes | yes |
| G3 touch targets | >= 44px | >= 44px | n/a (fine pointer) |
| G4 reflow | yes | yes | n/a |
| G5 regression | n/a | n/a | unchanged |
