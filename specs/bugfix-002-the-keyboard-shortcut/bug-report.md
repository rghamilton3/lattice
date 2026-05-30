# Bug Report: Question Mark Shortcut Does Not Focus Search Input

**Bug ID**: bugfix-002
**Branch**: `bugfix/002-the-keyboard-shortcut`
**Created**: 2026-05-29
**Severity**: [ ] Critical | [x] High | [ ] Medium | [ ] Low
**Component**: Command palette / search keyboard shortcut
**Status**: [ ] Investigating | [ ] Root Cause Found | [ ] Fixed | [x] Verified

## Input
User description: "The `?` keyboard shortcut doesn't focus the search bar input"

## Current Behavior
Pressing the `?` keyboard shortcut does not move focus to the search bar input. The shortcut appears to be ignored or handled without activating the search field.

## Expected Behavior
Pressing the `?` keyboard shortcut should focus the search bar input so the user can immediately type a search query.

## Reproduction Steps
1. Open the application view that includes the search bar input.
2. Ensure focus is not already inside the search bar input.
3. Press the `?` keyboard shortcut.
4. Observe that focus does not move to the search bar input.

**Frequency**: [x] Always | [ ] Sometimes | [ ] Rare
**Environment**: Browser UI; specific browser/OS not yet identified

## Root Cause Analysis
**Technical Explanation**:
The `?` global shortcut in `WorkbenchShell.svelte` opens the command palette when focus is outside editable controls. The palette search input previously relied on the HTML `autofocus` attribute, which is unreliable for this conditional Svelte mount path because the dialog is inserted after the keyboard event has already updated overlay state. As a result, the palette appeared but focus did not consistently move into the search textbox.

The fix makes focus an explicit mount behavior for the command palette input instead of relying on browser autofocus timing.

**Files Involved**:
- `surface/src/components/workbench/WorkbenchShell.svelte`
- `surface/src/components/overlays/CommandPalette.svelte`
- `surface/e2e/surface.e2e.ts`

**Related Features**:
- Command palette overlay
- Global keyboard shortcut handling
- Keyboard focus management


## Fix Strategy
**Approach**:
Keep the existing `?` shortcut behavior that opens the command palette from non-editable targets. Replace passive `autofocus` markup with a Svelte attachment that focuses the search input when the element mounts, ensuring the user can type immediately after pressing `?`. Add an e2e regression test that opens the palette with `?` and asserts that the search textbox has focus.


**Files to Modify**:
- `surface/src/components/overlays/CommandPalette.svelte`
- `surface/e2e/surface.e2e.ts`

**Breaking Changes**: [ ] Yes | [x] No


## Regression Test
*Created during /speckit.tasks and /speckit.implement (BEFORE applying fix)*

- [x] Test written that reproduces bug (fails before fix)
- [x] Test passes after fix applied
- [x] Test added to test suite (not orphaned)
- [x] Test covers edge cases identified during investigation

**Test File**: `surface/e2e/surface.e2e.ts`
**Test Description**: Validate that pressing `?` focuses the search bar input.

## Verification Checklist
- [ ] Bug reproduced in clean environment
- [x] Root cause identified and documented
- [x] Fix implemented
- [x] Regression test passes
- [x] Existing tests still pass
- [ ] Manual verification complete
- [x] Related documentation updated (if needed)

## Related Issues/Bugs
None identified yet.

## Prevention
Add regression coverage for keyboard shortcuts that move focus to primary interactive controls.

---
*Bug report created using `/bugfix` workflow - See .specify/extensions/workflows/bugfix/*
