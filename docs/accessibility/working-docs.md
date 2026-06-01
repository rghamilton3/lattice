# Accessibility Evidence: Working Docs

**Feature**: Working Docs
**Date**: 2026-05-29

## Scope

- Working-document rows in the workbench library.
- Markdown editor loading, missing-document, save, error, and delete states.
- Saved markdown preview when opened through the existing split-pane reading view.
- Editor actions: Back, Split, Save, Delete, and Vim mode toggle.
- Keyboard operation for browsing, opening, editing, preview links, saving, and deleting working documents.

## WCAG 2.2 AA Checks

- [x] Working-document rows are native buttons with document-specific accessible names.
- [x] Editor loading, missing-document, save, delete, and error states are communicated with visible text.
- [x] Save and delete status changes are exposed through a polite live status region.
- [x] Back, Split, Save, Delete, and Vim controls are keyboard reachable and have visible labels or accessible names.
- [x] The source editor is labelled for the active `{slug}.md` document; the preview opens in the other pane only after the Split action.
- [x] The default editor view does not open a preview pane automatically.
- [x] Preview freshness is communicated with visible status text: saved-only by default, stale while unsaved edits exist, refreshed after save, and retry guidance after save failure.
- [x] The split-pane preview retains the existing reading actions: Similar, Mentions, Attach, Edit, and Split.
- [x] Narrow default editor layout keeps toolbar actions and editor access usable without page-level horizontal scrolling.
- [x] Preview links remain keyboard reachable and do not trap focus away from editor or toolbar controls.
- [x] Render or save failure states preserve source editing, expose recoverable text, and keep Save available for recovery.
- [x] Missing-document errors include a keyboard-reachable path back to the library.
- [x] State is not communicated by color alone; status text remains visible alongside color.

## Notes

- Bilingual content is not required for this feature; new preview copy is concise English-only UI text.
- The CodeMirror editing surface remains the primary text-entry control. The surrounding workbench provides labelled actions plus saved-preview status/error messages through visible text and polite status regions.
- The preview uses the existing sanitized Markdown renderer in the reading pane. Long lines, code blocks, Mermaid, KaTeX, and links are constrained to pane overflow rather than document overflow. Renderer failures surface recoverable preview-failure text without blocking the editor.
- Delete requires explicit confirmation before removing a document.
- Automated verification on 2026-05-26: `cd spine && bun test tests/unit/working.test.ts tests/routes/working-route.test.ts` passed 43 tests; `cd surface && bun run check` reported 0 errors and 0 warnings.
- Automated verification on 2026-05-29: `cd surface && bun run check` reported 0 errors and 0 warnings; `cd surface && bun run test:unit -- --run` passed 39 tests across 7 files; `cd surface && bun run test:e2e` passed 23 tests. Playwright emitted host dependency warnings for fallback browser support (`libxml2`, `libflite1`), but the suite completed successfully.
- Repository verification on 2026-05-29: `just check` passed spine TypeScript and Surface Svelte checks.
- Automated verification on 2026-05-30: `cd surface && bun run check` reported 0 errors and 0 warnings; `cd surface && bun run test:unit -- --run` passed 39 tests across 7 files; `cd surface && bun run test:e2e` passed 24 tests. Playwright emitted host dependency warnings for fallback browser support (`libxml2`, `libflite1`), but the suite completed successfully.
- Repository verification on 2026-05-30: `just check` passed spine TypeScript and Surface Svelte checks.
