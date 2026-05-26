# Data Model: Surface Workbench

## Workbench Session

Represents browser-local UI preferences and active shell state.

- **Fields**: theme, density, reading font, posture, focus mode, Vim mode, panes, focused pane, active overlay, toast, deep-search state.
- **Identity**: One session per browser profile/window context.
- **Validation**: Persisted preferences must match known enum values or be ignored; corrupted stored JSON must not prevent rendering.
- **Lifecycle**: Created with defaults on app load, updated by user interactions, preference subset persisted to browser storage, reset to defaults if unavailable or invalid.

## Pane

Represents one visible work area.

- **Fields**: pane index, focus state, content reference, title label.
- **Identity**: Primary pane index 0; optional secondary pane index 1.
- **Validation**: A workbench has either one primary pane or primary plus secondary pane; closing the secondary pane must refocus the primary pane.
- **Lifecycle**: Created with home content, replaced by navigation/open actions, split by opening content in the other pane, removed by close action.

## Pane Content

Typed target rendered inside a pane.

- **Kinds**: home, library, results, document, editor, tasks.
- **Identity**: Discriminated by kind plus target values such as query, result source, document reference, or working slug.
- **Validation**: Unknown kinds are not valid; stale API data must render error/empty states rather than crashing the shell.
- **Lifecycle**: Produced by navigation, deep links, command palette, search results, lateral actions, triage, or editor actions.

## Document Reference

Stable reference to openable knowledge content.

- **Kinds**: capture id, indexed local file id, working document slug.
- **Identity**: Kind plus id/slug.
- **Validation**: Invalid references must fail visibly and non-destructively.
- **Lifecycle**: Created from deep links, search rows, library rows, attachments, working lists, and lateral actions; resolved through existing spine APIs.

## Overlay

Temporary interaction surface above the workbench.

- **Kinds**: none, quick capture, command palette, settings, new document, triage, new task, file upload.
- **Identity**: Exactly one active overlay state at a time.
- **Validation**: Keyboard ownership must be clear; triage and text-entry flows must not be interrupted by global shortcuts.
- **Lifecycle**: Opened by buttons/shortcuts, closed by completion/cancel/Escape where appropriate, not persisted across sessions.

## Workbench Preference

User-controlled display or interaction setting.

- **Fields**: theme, density, font, posture, focus mode, Vim mode.
- **Identity**: Preference name.
- **Validation**: Enum preferences must match supported values; font must be a non-empty supported label or safe fallback; booleans must be booleans.
- **Lifecycle**: Updated from settings or shell controls, persisted by layout-level effect, read during store construction.

## Status Summary

Text summary of spine and local agent health shown in the workbench shell.

- **Fields**: active agent count, latest scan time, spine label, stale/missing state.
- **Identity**: Current fetched status response.
- **Validation**: Missing status fields must show safe placeholder text; timestamps must be optional.
- **Lifecycle**: Refetched periodically while the browser is active and displayed as non-blocking shell text.
