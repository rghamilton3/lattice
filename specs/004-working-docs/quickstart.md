# Quickstart: Working Docs

## Automated Validation

1. Run spine working-doc tests:

   ```bash
   cd spine && bun test tests/unit/working.test.ts tests/routes/working-route.test.ts
   ```

2. Run surface validation:

   ```bash
   cd surface && bun run check
   ```

## Manual Validation

1. Start the app with the standard local stack:

   ```bash
   just dev
   ```

2. Open the workbench library with no search query.

3. Create a working document with a title and markdown body.

4. Confirm the document appears in the library list as a working item and opens in the workbench.

5. Edit markdown source and confirm save status changes from unsaved to saved.

6. Reopen the document and confirm markdown source was preserved exactly.

7. Delete the document and confirm it no longer appears in the list or opens by slug.

8. Accessibility spot-checks:

   - Working document rows have accessible names and are keyboard reachable.
   - Editor loading, save, and error states are visible and announced.
   - Back, save, Vim toggle, and delete controls have accessible names.
   - Focus remains visible throughout create, edit, save, and delete flows.
