# Research: Working Doc Preview Pane

## Decision: Refresh Preview From Saved Content After Successful Save

**Rationale**: The specification allows save-triggered preview refresh and only permits live refresh when it improves or simplifies the experience without reducing clarity. The existing editor already autosaves after changes and invalidates the working-doc detail query on successful save. A saved-content preview maps cleanly to user expectations and avoids implying unsaved edits are persisted.

**Alternatives considered**: Live preview on every CodeMirror update was considered because it can feel immediate, but it requires extra freshness messaging to avoid conflating unsaved edits with saved output and may increase render work for large documents. Manual refresh was rejected because it adds controls and friction without improving the core save-review workflow.

## Decision: Reuse Existing `MarkdownRenderer.svelte`

**Rationale**: Surface already has a sanitized markdown renderer with `marked`, DOMPurify, KaTeX, and Mermaid support. Reusing it satisfies common markdown rendering requirements, preserves existing rich-content safety behavior, and avoids adding dependencies or a parallel rendering path.

**Alternatives considered**: Adding a lightweight markdown-only renderer would reduce rich rendering behavior but duplicate sanitization decisions. Server-side rendering was rejected because it would add API and spine responsibility for a Surface presentation concern.

## Decision: Keep Preview State Local To `EditorPane.svelte`

**Rationale**: The preview belongs to one editor instance and can be derived from loaded content, successful save callbacks, dirty state, and render failures. Keeping it local avoids new global workbench state or API contracts and aligns with the constitution's simplicity principle.

**Alternatives considered**: Extending global workbench state was rejected because there is no cross-pane consumer. Persisting preview preferences was rejected because the spec does not require remembered layout or toggle state.

## Decision: Split Wide, Stack Or Collapse Narrow

**Rationale**: FR-002 requires split panes when space allows, while FR-003 and SC-005 prioritize usability on constrained displays. CSS can use responsive layout rules so the source editor remains primary at narrow widths, with preview available below or behind a simple visible section without hiding required controls.

**Alternatives considered**: Always side-by-side was rejected because it crowds the editor and creates horizontal scrolling on narrow viewports. Always tabs were rejected for desktop because they do not deliver the primary side-by-side preview value.

## Decision: Communicate Freshness With Existing Save Status Pattern

**Rationale**: The editor already exposes save status through visible text inside a polite live status region. Preview freshness can extend this pattern with labels such as "preview saved", "preview waiting for save", or "preview unavailable" so users understand saved-versus-unsaved status without color-only cues.

**Alternatives considered**: Icon-only freshness indicators were rejected for accessibility. A modal or toast on every change was rejected as disruptive.

## Decision: Update Working Docs Accessibility Evidence

**Rationale**: This feature changes user-facing editor layout, keyboard navigation order, status communication, and responsive behavior, all of which are covered by WCAG 2.2 AA validation. Existing `docs/accessibility/working-docs.md` is the correct evidence location.

**Alternatives considered**: Creating a new accessibility evidence file was rejected because the scope remains working documents and the existing evidence file already covers the editor.

## Decision: No Bilingual Delivery Work

**Rationale**: The current Surface working-doc editor is English-only and no multilingual workbench mode or translation contract exists. New labels/status text should remain concise English copy consistent with current UI.

**Alternatives considered**: Adding translation scaffolding was rejected as out of scope and a new abstraction without current project support.
