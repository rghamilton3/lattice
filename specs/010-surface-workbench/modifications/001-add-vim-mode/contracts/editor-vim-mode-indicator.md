# UI Contract: Editor Vim Mode Indicator

## Scope

This contract covers the user-facing Surface editor state indicator for the existing Vim mode preference. It does not define a spine API, database migration, or new persisted preference format.

## Preconditions

- A Surface workbench editor pane is rendered for a working document.
- The workbench context exposes the existing `vimMode` boolean preference and supported toggle paths.

## Required Behavior

### Indicator Visibility
- The editor MUST show Vim mode state in the editor context whenever editor controls are visible.
- The state MUST be understandable from text, accessible name/value, or both.
- Color, icon shape, or styling MAY reinforce state but MUST NOT be the only state signal.

### State Synchronization
- When `vimMode` is `true`, the indicator MUST communicate that Vim mode is on.
- When `vimMode` is `false`, the indicator MUST communicate that Vim mode is off.
- Toggling Vim mode from the editor control MUST update the indicator without remounting the editor solely for presentation.
- Toggling Vim mode from settings, command palette, or keyboard shortcut paths MUST update the indicator through the same `vimMode` source of truth.

### Keyboard And Editor Ownership
- Existing editor keyboard behavior MUST remain intact.
- Global workbench shortcuts MUST continue to avoid stealing keys from CodeMirror or other text-entry targets.
- Existing Vim ex commands for save, save-and-quit, and quit MUST remain unchanged.

### Backward Compatibility
- Existing persisted workbench preferences MUST remain readable without migration.
- Existing Surface and spine API contracts MUST remain unchanged.
- Users with Vim mode disabled MUST not be forced into Vim bindings.

## Acceptance Checks

- With Vim mode disabled, opening an editor shows an accessible disabled/off Vim state.
- After enabling Vim mode from the editor, the editor shows an accessible enabled/on Vim state.
- After toggling Vim mode from a non-editor path, the editor indicator reflects the new state.
- Automated or documented accessibility evidence confirms the state is not color-only.
