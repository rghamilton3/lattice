# Research: Editor Table of Contents Panel (021)

**Date**: 2026-06-13 | **Branch**: worktree-feat+toc

---

## Heading Extraction

**Decision**: Line-by-line regex scan of the CodeMirror document string.

**Rationale**: The livePreview extension (see `surface/src/lib/editor/livePreview.ts`) already walks the syntax tree per viewport update — that's appropriate for decoration-set computation but is overkill for the TOC. A plain text scan with `/^(#{1,6})\s+(.+)/` on each line is O(n) in document lines, deterministic, and produces no GC pressure from tree traversal. ATX-only headings are the only variant users type in working docs.

**Alternative considered**: Reuse the CodeMirror `syntaxTree` + `HEADING_LEVEL` map from livePreview. Rejected because it would require access to `EditorState` inside the TOC component, coupling it more tightly to CodeMirror internals. The plain text approach is simpler and testable without a view.

---

## CodeMirror Cursor Movement + Scroll

**Decision**: Use `view.dispatch({ selection: EditorSelection.cursor(line.from), effects: EditorView.scrollIntoView(line.from, { y: 'start', yMargin: 16 }) })` followed by `view.focus()`.

**Rationale**: `EditorView.scrollIntoView(pos, options)` is the standard CodeMirror 6 state effect for scrolling. Using `{ y: 'start' }` places the heading near the top of the viewport, matching the behavior of "jump to section" conventions in editors like Obsidian. Setting the cursor ensures the user is ready to edit immediately (consistent with Scenario 1 and the clarified FR-4).

**APIs used** (no new imports — both already present in EditorPane or available from existing CodeMirror packages):
- `EditorSelection` from `@codemirror/state` — already imported in EditorPane
- `EditorView.scrollIntoView` from `@codemirror/view` — available from the already-imported `EditorView`
- `state.doc.line(n)` — 1-based line accessor, returns `{ from, to, text }`

---

## Live Update / Debounce Pattern

**Decision**: Maintain a `docText: string` reactive state in `EditorPane.svelte`, updated on every `EditorView.updateListener` `docChanged` event. A separate `$effect` debounces this into `debouncedText` (300 ms), which feeds a `$derived` `tocEntries = parseToc(debouncedText)`.

**Rationale**: The update listener already runs on every keystroke to schedule autosave. Extending it to also update `docText` adds negligible overhead (a single `$state` assignment). The debounce separates the "fast path" (autosave scheduling, which has its own 1500 ms timer) from the "TOC path", keeping both independent.

**Alternative considered**: A CodeMirror `ViewPlugin` that produces a `StateField` of heading positions. Rejected: this would require exporting internal state out of the plugin into Svelte, adding complexity with no benefit over the simpler text-derived approach.

---

## localStorage Persistence

**Decision**: Read initial value from `localStorage.getItem('lattice.editor.tocOpen')` inside a `browser`-gated block during `$state` initialization. Persist in a `$effect` that writes on every `tocOpen` change.

**Rationale**: Consistent with the project pattern — `loadedContent`, vim mode, and theme are all session-level client-side state. `localStorage` is the right layer. Using the `browser` guard from `$app/environment` prevents SSR issues (even though surface uses static adapter).

**Key**: `lattice.editor.tocOpen` (string `'true'` / `'false'`). Default: `'true'` (open by default — more discoverable on first use).

---

## Layout Architecture

**Decision**: Add a flex row inside the content area of `EditorPane.svelte`:
- Left: `<div class="toc-sidebar">` — `width: 200px`, `border-right`, scrollable; hidden at narrow viewports via media query matching `--breakpoint-tablet` (64 rem)
- Right: existing editor container (`flex-1`, `min-width: 0`)

**Rationale**: The existing `editor-shell` is already a flex column (status bar + content area). Introducing a horizontal flex inside the content area is the minimal change needed. The 200 px panel fits comfortably alongside the editor's 46 rem centered column even in split-pane mode (two editors side by side at ~50% viewport each → ~512px per pane → 200px TOC + 312px editor is tight but usable; user can collapse if they need more room, per FR-4a clarification).

The toggle button lives in the `editor-status` bar, adding a `<button>` at tablet+ widths only (CSS hide at narrow). This follows the existing pattern of `VimToggle` in the same bar.

---

## CSS Token Selection

**Decision**: Use the following existing design tokens for the TOC panel:
- Background: `var(--bg-raised)` — one step above editor background, provides visual separation without a border box
- Border: `1px solid var(--line)` — matches existing separator patterns in `WorkbenchShell`
- Text: `var(--text-mute)` for entries (slightly de-emphasized vs editor prose), `var(--text)` on hover/focus
- Accent: `var(--c-accent)` for active/focused entry underline
- Empty state: `var(--text-faint)`

These tokens already adapt to all three themes (light / dark / sepia) via `[data-theme]` selectors in `layout.css`.

---

## New Files

| File | Purpose |
|------|---------|
| `surface/src/lib/editor/parseToc.ts` | Pure `parseToc(text): TocEntry[]` — isolated, unit-testable |
| `surface/src/components/editor/EditorToc.svelte` | TOC panel: entry list, empty state, keyboard nav |

## Modified Files

| File | Changes |
|------|---------|
| `surface/src/components/editor/EditorPane.svelte` | Add `docText` state, `debouncedText`, `tocEntries`, `tocOpen`, `navigateToLine()`, layout refactor, toggle button |
