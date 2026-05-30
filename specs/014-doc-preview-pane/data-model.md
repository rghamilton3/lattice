# Data Model: Working Doc Preview Pane

## Entity: Working Document

**Description**: Existing markdown document opened in the working document editor.

**Fields used by this feature**:

- `slug`: Existing document identifier used for fetch, save, delete, labels, and pane title.
- `content`: Markdown source loaded into CodeMirror and rendered in the preview.
- `savedContent`: UI-held snapshot of the latest content known to have saved successfully.
- `dirty`: Existing editor state indicating CodeMirror content differs from the latest saved snapshot or a save is pending.

**Validation rules**:

- Preview rendering must never mutate `content` or `savedContent`.
- Empty content renders an empty preview state rather than an error.
- Documents up to 25,000 characters must refresh preview within the success criterion after save.

## Entity: Editor Pane

**Description**: Existing source-editing area with Back, Save, Delete, Vim toggle, save status, and CodeMirror instance.

**Fields used by this feature**:

- `view`: CodeMirror `EditorView` instance containing current source text.
- `saveStatus`: Existing UI status for saved, error, and deleting states.
- `saveErrorMsg`: Existing action failure detail.
- `paneIndex`: Workbench pane identifier for navigation and closing behavior.

**Validation rules**:

- Save and delete controls remain keyboard reachable at all viewport widths.
- Editor remains usable when preview rendering fails.
- Keyboard focus must not become trapped between editor and preview regions.

## Entity: Preview Pane

**Description**: Rendered view of the working document markdown inside the editor shell.

**Fields**:

- `content`: Markdown string rendered by the preview, normally `savedContent`.
- `label`: Accessible label naming the preview for the current document.
- `visible`: Derived from successful document load and responsive layout; not persisted.
- `renderState`: `ready`, `empty`, or `error` from the user's perspective.

**Validation rules**:

- Must render headings, paragraphs, lists, links, emphasis, block quotes, and code blocks in readable form.
- Must sanitize rendered HTML through the existing renderer path.
- Long lines and code blocks must scroll or wrap inside the preview region without causing page-level horizontal scrolling.
- Render failures show recoverable text and do not block editing or saving.

## Entity: Preview Freshness State

**Description**: User-facing state explaining whether preview content reflects saved content or current unsaved edits.

**States**:

- `current`: Preview reflects the latest successfully saved content.
- `stale`: Editor has unsaved changes and preview still reflects saved content.
- `refreshing`: Save completed or content changed and preview is being updated.
- `unavailable`: Preview could not render; source editing remains available.

**Transitions**:

- Document load success -> `current` with loaded saved content.
- CodeMirror document change -> `stale` until save succeeds or a live-refresh implementation explicitly reflects current edits.
- Save success -> update `savedContent` and transition to `refreshing`, then `current` after preview accepts the content.
- Save failure -> remain `stale` and preserve previous preview content.
- Render failure -> `unavailable` while keeping editor state and save controls active.

**Validation rules**:

- State must be communicated with visible text, not color alone.
- Status changes that affect user understanding should be exposed through polite assistive-technology announcements.
- If implementation uses live preview, status text must not imply unsaved edits are saved.
