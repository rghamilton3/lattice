# UI Contract: Working Doc Editor Preview

## Scope

This contract describes the user-facing behavior of the Surface working document editor preview. It does not add or change spine REST endpoints.

## Entry Point

- Opening a working document editor for `slug` shows the existing editor shell.
- When document content loads successfully, the editor shell exposes both source editing and preview regions when the viewport can support them.

## Required Regions And Labels

- Source editor region: labelled as the markdown editor for `{slug}.md`.
- Preview region: labelled as the markdown preview for `{slug}.md`.
- Preview status: visible text that communicates one of the freshness states: current, stale/waiting for save, refreshing, or unavailable.
- Existing editor actions remain available: Back, Save, Delete, Vim toggle.

## Wide Layout Behavior

- Source and preview appear side by side inside the editor body.
- Required editor controls remain visible and reachable.
- Each pane manages its own overflow; long preview content does not create page-level horizontal scrolling.

## Constrained Layout Behavior

- The editor remains the primary usable area.
- The preview remains available without hiding save/delete/back controls.
- The layout may stack source and preview vertically or otherwise adapt, as long as keyboard and pointer users can reach both and no page-level horizontal scrolling is required.

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
