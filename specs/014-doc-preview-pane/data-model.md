# Data Model: Working Doc Preview Pane

## Entity: Working Document

**Description**: Existing markdown document opened in the working document editor.

**Fields used by this feature**:

- `slug`: Existing document identifier used for fetch, save, delete, labels, and pane title.
- `content`: Markdown source loaded into CodeMirror and rendered by the saved-content reading preview.
- `savedContent`: Latest content known to have saved successfully and returned by the working-document fetch used in the split preview.
- `dirty`: Existing editor state indicating CodeMirror content differs from the latest saved snapshot or a save is pending.

**Validation rules**:

- Preview rendering must never mutate `content` or `savedContent`.
- Empty content renders an empty preview state rather than an error.
- Documents up to 25,000 characters must refresh preview within the success criterion after save.

## Entity: Editor Pane

**Description**: Existing source-editing area with Back, Split, Save, Delete, Vim toggle, save status, preview status, and CodeMirror instance.

**Fields used by this feature**:

- `view`: CodeMirror `EditorView` instance containing current source text.
- `saveStatus`: Existing UI status for saved, error, and deleting states.
- `saveErrorMsg`: Existing action failure detail.
- `paneIndex`: Workbench pane identifier for navigation and closing behavior.
- `previewStatusText`: Visible saved-preview status derived from dirty edits, successful saves, and save failures.

**Validation rules**:

- Save and delete controls remain keyboard reachable at all viewport widths.
- Editor remains usable when preview rendering fails.
- Keyboard focus must not become trapped between editor and preview regions.

## Entity: Preview Pane

**Description**: Rendered reading view of the working document markdown opened in the other workbench pane by the editor Split action.

**Fields**:

- `content`: Markdown string fetched for the working document and rendered by the preview, normally the latest saved content.
- `label`: Accessible pane label naming the split-pane preview location.
- `visible`: Derived from the user opening Split and successful document load; not persisted.
- `renderState`: `ready`, `empty`, or `error` from the user's perspective.

**Validation rules**:

- Must render headings, paragraphs, lists, links, emphasis, block quotes, and code blocks in readable form.
- Must sanitize rendered HTML through the existing renderer path.
- Long lines and code blocks must scroll or wrap inside the preview region without causing page-level horizontal scrolling.
- Render failures show recoverable text and do not block editing or saving.

## Entity: Preview Freshness State

**Description**: User-facing state explaining whether preview content reflects saved content or current unsaved edits.

**States**:

- `saved`: Split preview opens with saved content.
- `stale`: Editor has unsaved changes and split preview still reflects saved content.
- `refreshed`: Save completed and the split preview has refreshed from saved content.
- `unavailable`: Preview could not render; source editing remains available.

**Transitions**:

- Document load success -> `saved` with loaded saved content.
- CodeMirror document change -> `stale` until save succeeds or a live-refresh implementation explicitly reflects current edits.
- Save success -> invalidate the working-document query and transition to `refreshed` once the split preview fetches saved content.
- Save failure -> remain `stale` and preserve previous preview content.
- Render failure -> `unavailable` while keeping editor state and save controls active.

**Validation rules**:

- State must be communicated with visible text, not color alone.
- Status changes that affect user understanding should be exposed through polite assistive-technology announcements.
- If implementation uses live preview, status text must not imply unsaved edits are saved.
