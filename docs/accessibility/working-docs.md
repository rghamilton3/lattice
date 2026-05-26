# Accessibility Evidence: Working Docs

**Feature**: Working Docs
**Date**: 2026-05-26

## Scope

- Working-document rows in the workbench library.
- Markdown editor loading, missing-document, save, error, and delete states.
- Editor actions: Back, Save, Delete, and Vim mode toggle.
- Keyboard operation for browsing, opening, editing, saving, and deleting working documents.

## WCAG 2.2 AA Checks

- [x] Working-document rows are native buttons with document-specific accessible names.
- [x] Editor loading, missing-document, save, delete, and error states are communicated with visible text.
- [x] Save and delete status changes are exposed through a polite live status region.
- [x] Back, Save, Delete, and Vim controls are keyboard reachable and have visible labels or accessible names.
- [x] Missing-document errors include a keyboard-reachable path back to the library.
- [x] State is not communicated by color alone; status text remains visible alongside color.

## Notes

- Bilingual content is not required for this feature.
- The CodeMirror editing surface remains the primary text-entry control. The surrounding workbench provides labelled actions and recoverable status/error messages.
- Delete requires explicit confirmation before removing a document.
- Automated verification on 2026-05-26: `cd spine && bun test tests/unit/working.test.ts tests/routes/working-route.test.ts` passed 43 tests; `cd surface && bun run check` reported 0 errors and 0 warnings.
