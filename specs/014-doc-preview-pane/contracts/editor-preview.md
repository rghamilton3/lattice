# UI Contract: Working Doc Editor Preview

## Scope

This contract describes the user-facing behavior of the Surface working document editor preview. It does not add or change spine REST endpoints.

## Entry Point

- Opening a working document editor for `slug` shows the existing editor shell.
- When document content loads successfully, the editor shell exposes a Split action that opens the saved markdown preview in the other workbench pane.

## Required Regions And Labels

- Source editor region: labelled as the markdown editor for `{slug}.md`.
- Preview pane: labelled by the workbench pane and rendered with the existing reading view for `{slug}.md`.
- Preview status: visible text that communicates saved-only, stale/waiting for save, refreshed, or recoverable failure states.
- Existing editor actions remain available: Back, Split, Save, Delete, Vim toggle.

## Wide Layout Behavior

- Source and preview appear side by side in the workbench after the user opens Split.
- Required editor controls remain visible and reachable.
- Each pane manages its own overflow; long preview content does not create page-level horizontal scrolling.

## Constrained Layout Behavior

- The editor remains the primary usable area.
- The preview remains available without hiding save/delete/back controls.
- The layout may keep only the editor visible until Split is requested or otherwise adapt, as long as keyboard and pointer users can reach required controls and no page-level horizontal scrolling is required.

## Refresh Behavior

- On document load, preview reflects loaded saved content.
- On source edits, if preview does not live-update, status indicates the preview is waiting for save or may not include unsaved edits.
- On successful save, preview refreshes to the saved content and status returns to current.
- On save failure, preview preserves the last successfully rendered content and status/error text makes continued editing possible.

## Render Behavior

- Common markdown renders readably: headings, paragraphs, lists, links, emphasis, block quotes, inline code, and code blocks.
- Empty content shows a non-disruptive empty state or empty preview area.
- Malformed or incomplete markdown renders best-effort output or escaped fallback text.
- Render failures are recoverable and do not block source editing or saving.

## Accessibility Requirements

- Keyboard users can move through editor controls, source editor, preview status/control, and preview links without traps.
- Focus indicators remain visible for all native controls and preview links.
- Status and errors are not communicated by color alone.
- Status changes use polite announcement behavior where they affect task understanding.
- Text, borders, focus, and status colors meet WCAG 2.2 AA contrast expectations.

## Out Of Scope

- New REST endpoints.
- Persisted preview preferences.
- Rich-text editing.
- Collaborative editing.
- Exporting rendered preview output.
- Bilingual UI delivery.
