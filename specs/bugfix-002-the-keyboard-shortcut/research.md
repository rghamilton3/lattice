# Research: Command Palette Question Mark Focus Fix

## Decision 1: Keep the `?` shortcut trigger in `WorkbenchShell.svelte`

**Decision**: Do not alter the existing shortcut guard. The current handler opens the command palette only when no overlay is open and the event target is not editable.

**Rationale**: The bug is not that the palette fails to open; it is that focus does not reliably land in the palette search textbox after open. Changing shortcut dispatch would increase risk and could regress editable-field suppression.

**Alternatives Considered**: Add a new global shortcut registry. Rejected as unnecessary abstraction for a single bugfix.

## Decision 2: Focus the palette input on mount with a Svelte attachment

**Decision**: Replace the input `autofocus` attribute with an explicit mount-time attachment that calls `element.focus()`.

**Rationale**: Svelte 5 attachments are intended for DOM behavior that runs when an element is mounted. This avoids `$effect` state wiring and avoids browser `autofocus` timing differences in conditionally mounted overlays.

**Alternatives Considered**: Use `bind:this` plus `$effect`. Rejected after Svelte autofixer suggested the attachment pattern was a better fit. Keep `autofocus`. Rejected because it is the source of unreliable focus behavior.

## Decision 3: Add Playwright e2e coverage

**Decision**: Add an e2e test that presses `?`, locates the command palette dialog, and asserts the search textbox is focused.

**Rationale**: The bug is an end-user keyboard/focus behavior; Playwright can verify real focus state in the browser.

**Alternatives Considered**: Unit-test the shortcut handler only. Rejected because it would not validate DOM focus after Svelte mount.
