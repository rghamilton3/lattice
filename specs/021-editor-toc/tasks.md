# Tasks: Editor Table of Contents Panel (021)

<!-- Tech Stack Validation: PASSED -->
<!-- Validated against: .specswarm/tech-stack.md -->
<!-- No prohibited technologies. All changes are in surface/src (TypeScript + Svelte). -->

**Feature**: Add a collapsible left-side TOC panel to the working document editor
**Branch**: `worktree-feat+toc`
**Plan**: [plan.md](./plan.md) | **Spec**: [spec.md](./spec.md)

---

## Completion Tracker

- [X] T001 [P] Create parseToc pure function and TocEntry type — surface/src/lib/editor/parseToc.ts
- [X] T002 [P] Add unit tests for parseToc — surface/src/lib/editor/parseToc.test.ts
- [X] T003 Create EditorToc panel component — surface/src/components/editor/EditorToc.svelte
- [X] T004 Integrate TOC into EditorPane: state, debounce, layout, toggle, navigation — surface/src/components/editor/EditorPane.svelte
- [X] T005 Type-check and lint the full surface package — (just check && just lint)

---

## Phase 1: Foundation — Heading Parser

**Goal**: A pure, testable function that extracts TOC entries from a markdown string.

**Independent test criteria**: `parseToc('')` returns `[]`; `parseToc('# Hello\n## World')` returns two entries with correct levels, text, and 1-based line numbers.

### T001 [P] — Create `parseToc.ts`

- [ ] T001 [P] Create parseToc pure function and TocEntry type — surface/src/lib/editor/parseToc.ts

**File**: `surface/src/lib/editor/parseToc.ts`

Create a new TypeScript module with:

1. Export the `TocEntry` interface:
   ```typescript
   export interface TocEntry {
     level: number;    // 1–6
     text: string;     // heading text without # prefix or trailing whitespace
     lineNumber: number; // 1-based
   }
   ```

2. Export `parseToc(docText: string): TocEntry[]`:
   - Split `docText` on `'\n'`
   - For each line, test `/^(#{1,6})\s+(.+)/`
   - If matched: push `{ level: m[1].length, text: m[2].trimEnd(), lineNumber: i + 1 }`
   - ATX-only (no Setext headings)
   - Return the array

---

### T002 [P] — Create `parseToc.test.ts`

- [ ] T002 [P] Add unit tests for parseToc — surface/src/lib/editor/parseToc.test.ts

**File**: `surface/src/lib/editor/parseToc.test.ts`

**Run with**: `cd surface && bun run test:unit --project server` (server project, not browser — pure function, no DOM needed)

Write Vitest unit tests covering:

1. Empty string returns `[]`
2. String with no headings returns `[]`
3. Single H1 returns one entry with `level: 1`, correct text, `lineNumber: 1`
4. H1 through H6 all detected with correct levels
5. Line numbers are 1-based and reflect actual position in multi-line doc
6. Leading/trailing whitespace in heading text is trimmed
7. Setext-style headings (line followed by `===` or `---`) are NOT detected
8. Headings inside fenced code blocks (```` ``` ````) ARE detected (ATX regex is line-based; we intentionally do not skip code blocks for simplicity — consistent with Assumption in spec)
9. `# ` (hash with space but no text after) is NOT matched (regex requires `.+` after `\s+`)
10. `#NoSpace` (no space after hash) is NOT matched

---

## Phase 2: TOC Component

**Goal**: A Svelte component that renders a navigable heading list with empty state and keyboard support.

**Depends on**: T001 (needs `TocEntry` type)

**Independent test criteria**: Component renders "No headings found" when `entries` is empty; renders all entries with correct indentation when populated.

### T003 — Create `EditorToc.svelte`

- [X] T003 Create EditorToc panel component — surface/src/components/editor/EditorToc.svelte

**File**: `surface/src/components/editor/EditorToc.svelte`

Create a new Svelte 5 component with `<script lang="ts">`:

**Props**:
```typescript
const { entries, onNavigate }: {
  entries: import('$lib/editor/parseToc').TocEntry[];
  onNavigate: (lineNumber: number) => void;
} = $props();
```

**Template**:
- Wrap everything in `<nav class="toc-panel" aria-label="Table of contents">`
- When `entries.length === 0`: render `<p class="toc-empty">No headings</p>`
- When `entries.length > 0`: render `<ul role="list">` with one `<li>` per entry
  - Each `<li>` contains a `<button class="toc-entry" type="button">` with:
    - `style="padding-left: {(entry.level - 1) * 14}px"` for indentation
    - `onclick={() => onNavigate(entry.lineNumber)}`
    - `title={entry.text}` (shows full text on hover for truncated entries)
    - Text content: `entry.text`
  - Keyboard: standard button behavior (Enter/Space activate, Tab navigates between entries)

**Styles** (in `<style>` block, using CSS custom properties only):
```css
.toc-panel {
  padding: 8px 0;
  height: 100%;
}

ul {
  list-style: none;
  margin: 0;
  padding: 0;
}

.toc-entry {
  display: block;
  width: 100%;
  text-align: left;
  padding: 3px 10px 3px 0;
  padding-left: inherit; /* overridden by style attr */
  background: none;
  border: none;
  cursor: pointer;
  font-size: 12px;
  line-height: 1.4;
  color: var(--text-mute);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
  border-radius: 3px;
}

.toc-entry:hover,
.toc-entry:focus-visible {
  color: var(--text);
  background: var(--bg-high);
  outline: none;
}

.toc-empty {
  font-size: 11px;
  color: var(--text-faint);
  padding: 8px 10px;
  font-style: italic;
}
```

---

## Phase 3: Editor Integration

**Goal**: Wire the TOC into `EditorPane.svelte` with live updates, collapsible state, layout, and navigation.

**Depends on**: T001 (TocEntry type and parseToc), T003 (EditorToc component)

**Independent test criteria**: Opening the editor with a markdown document shows the TOC panel with headings listed; clicking an entry scrolls to and focuses that line; toggling the panel collapses/expands it; localStorage persists the state across refresh.

### T004 — Modify `EditorPane.svelte`

- [ ] T004 Integrate TOC into EditorPane: state, debounce, layout, toggle, navigation — surface/src/components/editor/EditorPane.svelte

**File**: `surface/src/components/editor/EditorPane.svelte`

Make the following changes to `surface/src/components/editor/EditorPane.svelte`:

**1. Add imports** (at the top of `<script lang="ts">`):
```typescript
import { browser } from '$app/environment';  // already imported via docQuery
import { EditorSelection } from '@codemirror/state'; // already imported
import { parseToc } from '$lib/editor/parseToc';
import type { TocEntry } from '$lib/editor/parseToc';
import EditorToc from './EditorToc.svelte';
```
Note: `EditorSelection` is already imported. Only `parseToc`, `TocEntry`, and `EditorToc` are new imports.

**2. Add state variables** (after the existing `$state` declarations):
```typescript
let docText = $state('');
let debouncedText = $state('');
let tocOpen = $state(browser ? localStorage.getItem('lattice.editor.tocOpen') !== 'false' : true);
```

**3. Add derived TOC entries**:
```typescript
const tocEntries: TocEntry[] = $derived(parseToc(debouncedText));
```

**4. Add debounce effect** (after existing `$effect` blocks):
```typescript
let tocDebounceTimer: ReturnType<typeof setTimeout> | null = null;
$effect(() => {
  const text = docText;
  if (tocDebounceTimer) clearTimeout(tocDebounceTimer);
  tocDebounceTimer = setTimeout(() => { debouncedText = text; }, 300);
  return () => { if (tocDebounceTimer) clearTimeout(tocDebounceTimer); };
});
```

**5. Add localStorage persistence effect**:
```typescript
$effect(() => {
  if (browser) localStorage.setItem('lattice.editor.tocOpen', String(tocOpen));
});
```

**6. Update `docText` in the mount `$effect`**:
In the existing mount `$effect` (the one that creates the CodeMirror view), after `loadedContent = docQuery.data.content;`:
```typescript
docText = docQuery.data.content;
```
Also update the `EditorView.updateListener` callback:
```typescript
EditorView.updateListener.of((update) => {
  if (update.docChanged && !adoptingServerContent) {
    const content = update.state.doc.toString();
    scheduleAutosave(content);
    docText = content;  // ← add this line
  }
})
```

**7. Add `navigateToLine` function**:
```typescript
function navigateToLine(lineNumber: number) {
  if (!view) return;
  const line = view.state.doc.line(lineNumber);
  view.dispatch({
    selection: EditorSelection.cursor(line.from),
    effects: EditorView.scrollIntoView(line.from, { y: 'start', yMargin: 16 })
  });
  view.focus();
}
```

**8. Update HTML layout** — replace the existing:
```html
<div class="min-h-0 flex-1 overflow-hidden">
  ... editor content ...
</div>
```
with:
```html
<div class="content-row">
  {#if tocOpen}
    <div class="toc-sidebar">
      <EditorToc entries={tocEntries} onNavigate={navigateToLine} />
    </div>
  {/if}
  <div class="editor-area">
    ... existing editor content (unchanged) ...
  </div>
</div>
```

**9. Add TOC toggle button** to the `editor-status` bar, after the Back button:
```html
<button
  type="button"
  class="btn btn-ghost toc-toggle"
  title={tocOpen ? 'Hide table of contents' : 'Show table of contents'}
  aria-label={tocOpen ? 'Hide table of contents' : 'Show table of contents'}
  aria-pressed={tocOpen}
  onclick={() => (tocOpen = !tocOpen)}
>
  <Icon name="list" size={14} />
</button>
```
Use the existing `list` icon if available, otherwise `align-left` or `menu` — check `surface/src/components/icons/Icon.svelte` for available icon names.

**10. Add CSS** to the `<style>` block:
```css
.content-row {
  display: flex;
  flex: 1;
  min-height: 0;
  overflow: hidden;
}

.toc-sidebar {
  width: 200px;
  flex-shrink: 0;
  border-right: 1px solid var(--line);
  background: var(--bg-raised);
  overflow-y: auto;
  overflow-x: hidden;
}

.editor-area {
  flex: 1;
  min-width: 0;
  overflow: hidden;
  height: 100%;
}

@media (width < 64rem) {
  .toc-sidebar { display: none; }
  .toc-toggle { display: none; }
}
```

**11. Clean up**: Remove the old `class="min-h-0 flex-1 overflow-hidden"` div wrapper that previously held the editor content (it is now replaced by `.content-row` + `.editor-area`). Do not add duplicate wrappers.

---

## Phase 4: Quality Gates

### T005 — Type-check and lint

- [ ] T005 Type-check and lint the full surface package — (just check && just lint)

Run from repo root:
```bash
just check && just lint
```

Fix any TypeScript errors (`svelte-check`, `tsc --noEmit`) or lint warnings before marking complete. The most likely issues are:
- Missing `$derived` generic type annotation for `tocEntries`
- `EditorView.scrollIntoView` import scope (it is a static method on the class, not a named import)
- Icon name mismatch if the chosen icon does not exist in `Icon.svelte`

---

## Dependency Graph

```
T001 (parseToc.ts)
  ├── T002 (parseToc.test.ts) [parallel with T001 — different file]
  └── T003 (EditorToc.svelte) → T004 (EditorPane.svelte) → T005 (check+lint)
```

T001 and T002 can start simultaneously.
T003 must wait for T001 (imports TocEntry type).
T004 must wait for T001 and T003.
T005 is the final gate.

## Parallel Execution

**Batch 1 (parallel)**: T001 + T002
**Batch 2 (sequential)**: T003 → T004 → T005

## MVP Scope

T001 → T003 → T004 delivers the full feature (all 5 user scenarios). T002 and T005 are quality gates and should not be skipped. Total: 5 tasks.
