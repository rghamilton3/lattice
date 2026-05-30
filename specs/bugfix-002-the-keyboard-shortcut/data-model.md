# Data Model: Command Palette Focus

No persistent data model changes are required.

## Runtime State

| State | Owner | Purpose | Change |
|-------|-------|---------|--------|
| `wb.activeOverlay` | `surface/src/lib/state/workbench.svelte.ts` | Determines which overlay is rendered | Existing `palette` value remains unchanged |
| `q` | `CommandPalette.svelte` | Command palette search query | Unchanged |
| `active` | `CommandPalette.svelte` | Active command palette result index | Unchanged |
| Mounted search input element | `CommandPalette.svelte` DOM | Receives keyboard focus when palette mounts | Focused via local attachment |

## Invariants

- Opening the palette must not mutate persisted user data.
- The search input must be focused once it is mounted.
- The `?` shortcut must remain suppressed for editable event targets.
