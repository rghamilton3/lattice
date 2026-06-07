# Bug Report: Tab key tabs out of CodeMirror editor instead of inserting tab character

**Bug ID**: bugfix-003
**Branch**: `bugfix/003-tab-in-codemirror`
**Created**: 2026-06-07
**Severity**: [ ] Critical | [x] High | [ ] Medium | [ ] Low
**Component**: CodeMirror editor component
**Status**: [ ] Investigating | [ ] Root Cause Found | [x] Fixed | [ ] Verified

## Input
User description: "tab in codemirror editor actually tabs out of the editor instead of insert a tab char"

## Current Behavior
When a user presses the `Tab` key while focused inside a CodeMirror editor instance, focus moves to the next focusable element on the page (i.e., the default browser tab-out behavior) instead of inserting a tab character or indenting the content.

## Expected Behavior
Pressing `Tab` inside the CodeMirror editor should insert a tab character (or perform the configured indentation behavior) and keep focus within the editor.

## Reproduction Steps
1. Open the application and navigate to a view containing a CodeMirror editor
2. Click inside the editor to focus it
3. Press the `Tab` key
4. Observe that focus leaves the editor (moves to next focusable element) instead of inserting a tab/indent

**Frequency**: [x] Always | [ ] Sometimes | [ ] Rare
**Environment**: All browsers / OS (CodeMirror-level key handling)

## Root Cause Analysis

**Technical Explanation**:
The CodeMirror editor keymap in `EditorPane.svelte` (lines 295–313) does not include `indentWithTab` from `@codemirror/commands`. The `defaultKeymap` spread into the keymap does NOT contain a Tab binding — Tab handling must be explicitly added via `indentWithTab`. Without a CodeMirror key handler for Tab, the browser's default behavior takes over and moves focus to the next focusable element on the page.

**Files Involved**:
- `surface/src/components/editor/EditorPane.svelte:14` - `@codemirror/commands` is imported but `indentWithTab` is not included
- `surface/src/components/editor/EditorPane.svelte:295-313` - keymap configuration missing `indentWithTab`

**Related Features**:
CodeMirror editor in the workbench (specs/010-surface-workbench)

## Fix Strategy

**Approach**:
Import `indentWithTab` from `@codemirror/commands` and add it to the `keymap.of([...])` array in `EditorPane.svelte`. This gives CodeMirror a handler for the Tab key, preventing the browser default (focus move) from activating.

**Files to Modify**:
- `surface/src/components/editor/EditorPane.svelte` - add `indentWithTab` import and include it in the keymap

**Breaking Changes**: [ ] Yes | [x] No
[If yes, explain impact and migration path]

## Regression Test

- [x] Test written that reproduces bug (fails before fix)
- [x] Test passes after fix applied
- [x] Test added to test suite (not orphaned)
- [x] Test covers edge cases identified during investigation

**Test File**: `surface/e2e/surface.e2e.ts:329`
**Test Description**: Verifies Tab keeps focus in CodeMirror editor and inserts leading whitespace

## Verification Checklist
- [x] Bug reproduced in clean environment
- [x] Root cause identified and documented
- [x] Fix implemented
- [x] Regression test passes
- [x] Existing tests still pass
- [ ] Manual verification complete
- [ ] Related documentation updated (if needed)

## Related Issues/Bugs
[Link to other bugs that might be related or caused by same root issue]

## Prevention
[How can we prevent this class of bug in the future? New validation? Better tests? Refactoring?]

---
*Bug report created using `/bugfix` workflow - See .specify/extensions/workflows/bugfix/*
