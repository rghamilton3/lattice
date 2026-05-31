# Tasks: Command Palette Question Mark Focus Fix

**Input**: `bug-report.md`, `spec.md`, `plan.md`, `research.md`, `data-model.md`, `contracts/command-palette-focus.md`

## Phase 1: Investigation

- [x] T001 Identify existing `?` shortcut handling in `surface/src/components/workbench/WorkbenchShell.svelte`.
- [x] T002 Identify command palette input focus behavior in `surface/src/components/overlays/CommandPalette.svelte`.
- [x] T003 Document root cause and strategy in `specs/bugfix-002-the-keyboard-shortcut/bug-report.md`.

## Phase 2: Regression Test

- [x] T004 Add Playwright regression coverage in `surface/e2e/surface.e2e.ts` for `?` opening the palette and focusing the search textbox.
- [ ] T005 Run the targeted Playwright test before the fix when browser installation is available. Browser installation timed out before the fix, so no pre-fix result was captured.

## Phase 3: Implementation

- [x] T006 Replace `autofocus` in `CommandPalette.svelte` with explicit mount-time focus using a Svelte attachment.
- [x] T007 Preserve existing command palette input value binding, keyboard navigation, and close behavior.

## Phase 4: Verification

- [x] T008 Run Svelte autofixer on `CommandPalette.svelte` and resolve issues/suggestions.
- [x] T009 Run `bun run check` from `surface/`.
- [x] T010 Run targeted Playwright e2e test if browser installation/cache permits.
- [x] T011 Update verification checklist in `bug-report.md` with final results.
