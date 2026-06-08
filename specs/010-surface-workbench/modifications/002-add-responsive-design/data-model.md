# Data Model: Add Responsive Design To Surface UI

**N/A - no data model changes.**

This modification is presentation-only. It introduces no new entity, no new
persisted preference, and no schema or API change.

## Existing state touched (read-only context)

- **Workbench split state** (`surface/src/lib/state/workbench.svelte.ts`):
  `panes` (1 or 2 `PaneContent`) and `isSplit`/`focusedPane`. The responsive
  single-pane collapse **reads** these to decide which pane renders full width
  on narrow viewports but does **not** mutate them. Resizing back to desktop
  restores the existing two-pane view because the state is never changed.

- **Density preference** (`density`: compact | comfortable | spacious):
  orthogonal to viewport breakpoints. It scales type and spacing tokens and is
  left exactly as-is. Breakpoint tokens are a separate, new token family that
  does not interact with the persisted density value.

No migration, validation rule, or state transition is added by this
modification.
