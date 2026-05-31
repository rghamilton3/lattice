# Contract: Command Palette Focus Behavior

## Trigger

- User presses bare `?` while no overlay is open.
- Event target is not an editable input, textarea, contenteditable element, textbox role, or CodeMirror editor.

## Expected UI State

- `wb.activeOverlay` becomes `palette`.
- The command palette dialog with accessible name `Command palette` is visible.
- The input with accessible name `Command palette search` is focused after mount.

## Non-Goals

- Does not change command palette result ordering.
- Does not change `Ctrl/Cmd+K` behavior.
- Does not activate the palette when typing `?` inside editable controls.
