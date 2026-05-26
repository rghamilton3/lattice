# Quickstart: Retrieval Search

## Automated Validation

1. Run spine retrieval route tests:

   ```bash
   cd spine && bun test tests/routes/search.test.ts tests/routes/lateral.test.ts tests/routes/files.test.ts
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

2. Seed or ingest captures and indexed files through the existing capture and agent flows.

3. Search for text known to exist in a capture or indexed file.

4. Confirm search results show a source kind, snippet, title/path, and usable Open/Similar actions.

5. Browse indexed files and confirm newest-first ordering and stable paging.

6. Open a valid raw file and confirm missing or unsafe paths are denied clearly.

7. From a capture, working doc, or file result, open Similar and confirm the source item is not repeated.

8. Open Nearby around a timestamp and confirm returned captures/files are inside the requested window.

9. Accessibility spot-checks:

   - Search/results states communicate loading, empty, and errors with visible text.
   - Result action buttons have accessible names and are keyboard reachable.
   - Filter controls expose pressed/minimized state and can be operated by keyboard.
   - Result snippets and metadata remain readable on supported desktop and mobile widths.
