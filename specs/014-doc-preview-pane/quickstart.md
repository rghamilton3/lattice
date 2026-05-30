# Quickstart: Working Doc Preview Pane

## Prerequisites

- Install dependencies for Surface and Spine as usual for the monorepo.
- Run the development stack with `just dev`, or run spine and surface separately with `just spine` and `just surface`.

## Manual Validation

1. Open Surface in the browser and navigate to the workbench library.
2. Open or create a working document with markdown content including headings, lists, links, emphasis, block quotes, and code blocks.
3. Open the working document editor.
4. Confirm the markdown source editor opens by itself and no preview pane opens by default.
5. Use Split to open the rendered markdown preview in the other pane.
6. Confirm the split preview retains the existing reading actions: Similar, Mentions, Attach, Edit, and Split.
7. Edit the source without saving and confirm the split preview continues to show the saved content and the editor says unsaved edits are not included until Save.
8. Save the document and confirm the split preview reflects the saved content within 2 seconds and the editor says the preview refreshed from saved content.
9. Introduce incomplete markdown and confirm editing and saving remain available; if rendering fails, confirm the reading pane shows recoverable preview-render-failure text.
10. Resize to a narrow viewport and confirm editor controls, source editing, save, and Split access remain usable without page-level horizontal scrolling.
11. Navigate using only the keyboard through Back, Split, editor, preview links, Save, Delete, and Vim toggle; confirm there is no focus trap.
12. Force or simulate a save failure if practical and confirm the previous split preview remains visible while the editor says Save can be retried to refresh it.

## Automated Checks

```bash
cd surface && bun run check
cd surface && bun run test:unit -- --run
cd surface && bun run test:e2e
just check
```

Run the full e2e suite when browser dependencies are available. If the implementation adds focused tests, run those first before broader validation.

## Validation Results

- 2026-05-29: `cd surface && bun run check` passed with 0 errors and 0 warnings.
- 2026-05-29: `cd surface && bun run test:unit -- --run` passed 39 tests across 7 files.
- 2026-05-29: `cd surface && bun run test:e2e` passed 23 tests. Playwright reported fallback browser host dependency warnings for `libxml2` and `libflite1`, but all tests completed successfully.
- 2026-05-29: `just check` passed repository checks for spine TypeScript and Surface Svelte diagnostics.
- 2026-05-30: `cd surface && bun run check` passed with 0 errors and 0 warnings.
- 2026-05-30: `cd surface && bun run test:unit -- --run` passed 39 tests across 7 files.
- 2026-05-30: `cd surface && bun run test:e2e` passed 24 tests. Playwright reported fallback browser host dependency warnings for `libxml2` and `libflite1`, but all tests completed successfully.
- 2026-05-30: `just check` passed repository checks for spine TypeScript and Surface Svelte diagnostics.
- Surface-only scope confirmed: no spine route, migration, auth, storage, or API contract files were intentionally changed.

## Accessibility Evidence

- Update `docs/accessibility/working-docs.md` with the commands run, manual keyboard/reflow checks, and any residual risks.
- Bilingual validation is N/A because this feature adds English-only workbench UI/status text and no multilingual delivery mode exists.
- CLI accessibility validation is N/A because no user-facing terminal output changes.
