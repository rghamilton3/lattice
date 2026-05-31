# Feature Specification: Question Mark Shortcut Focuses Command Palette Search

**Feature Branch**: `bugfix/002-the-keyboard-shortcut`
**Created**: 2026-05-29
**Status**: Ready for implementation
**Input**: Bug report from `specs/bugfix-002-the-keyboard-shortcut/bug-report.md`

## User Scenarios & Testing

### User Story 1 - Start searching from keyboard shortcut (Priority: P1)

A user presses `?` while focus is outside editable content and expects the command palette search textbox to be focused immediately so typing continues into the palette.

**Independent Test**: Open the surface app, press `?`, assert that the command palette dialog is visible and the textbox named `Command palette search` is focused.

**Acceptance Criteria**:

1. Given the home view is visible and no overlay is open, when the user presses `?`, then the command palette opens.
2. Given the command palette opens from `?`, when the dialog is visible, then the command palette search textbox has focus.
3. Given focus is inside an editable control, when the user presses `?`, then existing editable-target shortcut suppression continues to prevent overlay activation.

## Requirements

### Functional Requirements

- **FR-001**: The existing `?` shortcut must continue to open the command palette from non-editable targets.
- **FR-002**: The command palette search input must receive focus when the palette is mounted.
- **FR-003**: Focus behavior must not depend on the HTML `autofocus` attribute.
- **FR-004**: A regression test must assert both palette visibility and search input focus for the `?` shortcut.

### Non-Functional Requirements

- **NFR-001**: The fix must not add runtime dependencies.
- **NFR-002**: The fix must preserve existing command palette keyboard navigation behavior.
- **NFR-003**: The fix must remain compatible with Svelte 5 runes mode.

## Scope

In scope: command palette focus behavior, `?` shortcut regression coverage, bugfix planning documentation.

Out of scope: redesigning the command palette, changing shortcut mappings, adding a global shortcut manager.

## Success Criteria

- Pressing `?` opens the command palette and focuses the search input.
- Existing surface type checks pass.
- The targeted e2e test is available in the committed e2e suite.
