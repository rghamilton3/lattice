# Quickstart: Working Doc Preview Pane

## Prerequisites

- Install dependencies for Surface and Spine as usual for the monorepo.
- Run the development stack with `just dev`, or run spine and surface separately with `just spine` and `just surface`.

## Manual Validation

1. Open Surface in the browser and navigate to the workbench library.
2. Open or create a working document with markdown content including headings, lists, links, emphasis, block quotes, and code blocks.
3. Open the working document editor.
4. On a desktop-width viewport, confirm the markdown source editor and rendered preview are both visible in the editor area.
5. Edit the source without saving and confirm the interface communicates whether the preview is stale or waiting for save.
6. Save the document and confirm the preview reflects the saved content within 2 seconds.
7. Introduce incomplete markdown and confirm editing and saving remain available.
8. Resize to a narrow viewport and confirm editor controls, source editing, save, and preview access remain usable without page-level horizontal scrolling.
9. Navigate using only the keyboard through Back, editor, preview status/links, Save, Delete, and Vim toggle; confirm there is no focus trap.
10. Force or simulate a save failure if practical and confirm the previous preview remains visible while the error is recoverable.

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
- Surface-only scope confirmed: no spine route, migration, auth, storage, or API contract files were intentionally changed.

## Accessibility Evidence

- Update `docs/accessibility/working-docs.md` with the commands run, manual keyboard/reflow checks, and any residual risks.
- Bilingual validation is N/A because this feature adds English-only workbench UI/status text and no multilingual delivery mode exists.
- CLI accessibility validation is N/A because no user-facing terminal output changes.
