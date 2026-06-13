---
parent_branch: main
feature_number: "021"
status: In Progress
created_at: 2026-06-13T16:40:00+00:00
references_consulted:
  - specs/014-doc-preview-pane/plan.md
  - specs/004-working-docs/spec.md
---

# Feature: Editor Table of Contents Panel

## Overview

Add a collapsible left-side table of contents (TOC) panel to the working document editor. The panel scans the current document for markdown headings (H1–H6), renders them as a hierarchical navigation tree, and scrolls the CodeMirror editor to the corresponding heading when a user clicks an entry. The TOC updates live as the user edits the document.

## User Scenarios

**Scenario 1 — Navigate a long document by section**
A user is editing a long working document with many headings. They open the TOC panel, see all headings listed with visual indentation reflecting their level (H1 flush, H2 indented one step, H3 two steps, etc.), and click "## Architecture" to jump the editor cursor and viewport to that section.

**Scenario 2 — Collapse the TOC to reclaim space**
A user on a moderately wide viewport finds the TOC panel takes up too much room. They click the toggle button to collapse the panel. The editor expands back to full width and the collapsed state persists across page refreshes via `localStorage`.

**Scenario 3 — Document with no headings**
A user opens a capture note that contains only prose with no headings. The TOC panel displays an empty-state message ("No headings found") rather than a blank panel.

**Scenario 4 — Live update while typing**
A user types a new `## Summary` heading into the editor. The TOC panel refreshes within one second to show the new heading without any manual action.

**Scenario 5 — Narrow / mobile viewport**
On a viewport narrower than the tablet breakpoint (64 rem), the TOC panel is hidden automatically and the editor occupies full width. No TOC toggle is shown at narrow widths.

## Functional Requirements

**FR-1**: The TOC panel MUST appear to the left of the CodeMirror editor area within `EditorPane.svelte`.

**FR-2**: The TOC MUST parse headings from the live document source (the CodeMirror document string, not the saved API response) so it reflects unsaved edits.

**FR-3**: Headings H1–H6 MUST appear in the TOC. Each entry MUST be visually indented proportional to its level (H1 = 0 indent, H2 = 1 step, … H6 = 5 steps).

**FR-4**: Clicking a TOC entry MUST move the CodeMirror editor cursor to the heading line AND scroll the viewport to place that heading at or near the top of the visible area.

**FR-4a**: The TOC panel MUST remain visible at tablet+ widths regardless of whether the workbench is in split-pane mode. The user MAY collapse it manually via the toggle if space is insufficient.

**FR-5**: The TOC MUST update reactively when the document content changes, with a debounce of at most 300 ms to avoid excessive re-parsing on every keystroke.

**FR-6**: The TOC panel MUST be collapsible via a toggle control visible at tablet+ widths. Collapsed state MUST persist across refreshes (`localStorage` key `lattice.editor.tocOpen`).

**FR-7**: When the document contains no headings, the panel MUST show a short empty-state message rather than a blank or error state.

**FR-8**: At viewport widths below the tablet breakpoint (64 rem, matching the existing `--breakpoint-tablet` breakpoint), the TOC panel MUST be hidden and the editor MUST occupy full width. The toggle button MUST also be hidden at narrow widths.

**FR-9**: The TOC MUST respect the active editor theme (dark / light / sepia) — panel background and text colors MUST use existing CSS custom property tokens, not hardcoded values.

**FR-10**: Keyboard users MUST be able to navigate the TOC entry list and activate entries without a mouse (standard tab / enter / space interaction).

## Success Criteria

- A user editing a 50-heading document can navigate to any section in under 3 seconds.
- The TOC panel refresh is imperceptible during normal typing (debounce keeps re-parse off the hot path).
- Collapsed state survives a hard browser refresh.
- The editor remains fully usable at viewport widths below the tablet breakpoint with no layout breakage.
- TOC entries with heading text longer than the panel width truncate with an ellipsis and show the full text on hover / focus.
- No new runtime dependency is introduced.

## Key Entities

| Entity | Description |
|--------|-------------|
| `TocEntry` | `{ level: 1–6, text: string, lineNumber: number }` — derived from the document string |
| `EditorPane.svelte` | Host component; gains a left panel region and TOC toggle state |
| `EditorToc.svelte` | New component — renders the entry list, handles click-to-scroll, shows empty state |
| `localStorage` key | `lattice.editor.tocOpen` (boolean) — persists collapsed/expanded preference |

## Assumptions

- Heading detection uses a simple line-by-line regex (`/^(#{1,6})\s+(.+)/`) applied to the CodeMirror document string. ATX-style headings only (no Setext underline headings). This is consistent with the project's existing markdown mode and matches the content users write in practice.
- The TOC panel width is fixed at approximately 200 px when expanded; this is sufficient for most heading text at the default font size.
- The TOC does not need to highlight the "current" heading based on scroll position in this iteration — navigation only (click-to-scroll), not scroll-to-highlight.
- No spine API changes are required; the TOC is purely a client-side, presentation-layer enhancement.
- Accessibility target: WCAG 2.2 AA, consistent with the existing editor (per `specs/014-doc-preview-pane/plan.md` constraints).

## Clarifications

### Session 2026-06-13

- Q: TOC visibility in split-pane mode → A: Always show at tablet+ widths; user collapses manually if needed (FR-4a added).
- Q: Click action in CodeMirror → A: Move cursor to heading line AND scroll viewport (FR-4 updated).

## Sources

This spec was generated by consulting the following references (per `.specswarm/references.md`):

| Source | Sections informing this spec |
|--------|------------------------------|
| `specs/014-doc-preview-pane/plan.md` | Tech context (Svelte 5 runes, CodeMirror 6, TanStack Query), constraints (no new runtime dep, no spine changes, WCAG 2.2 AA, tablet breakpoint 64 rem), constitution gate checklist |
| `surface/src/components/editor/EditorPane.svelte` | Existing editor layout, theme system, CodeMirror view access pattern, `editor-shell` / `editor-status` CSS structure |
| `surface/src/components/workbench/WorkbenchShell.svelte` | Pane layout, tablet breakpoint usage, existing split-view pattern |
