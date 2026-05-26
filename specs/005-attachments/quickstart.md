# Quickstart: Attachments

## Automated Validation

Run targeted spine route and retrieval tests:

```bash
cd spine && bun test tests/routes/attachments.test.ts tests/routes/working-attachments.test.ts tests/routes/search.test.ts
```

Run surface type and Svelte validation:

```bash
cd surface && bun run check
```

## Manual Validation

1. Start the local app with the normal development environment.
2. Create or locate a capture, open it in the reading pane, and attach a small text file.
3. Confirm the attachment rail lists filename and size, and the raw attachment opens or downloads.
4. Open a working document, attach a file, and confirm it appears only on that working document.
5. Delete each attachment and confirm the rail updates and the raw URL no longer returns the file.
6. Search for an uploaded attachment filename before and after deletion to confirm metadata is added then removed.
7. Open a PDF local file or PDF attachment path where available and confirm loading and error states are readable.
8. Keyboard-test upload, open, minimize/expand, and delete controls; verify visible focus and screen-reader labels are present.

## Accessibility Evidence

Update `docs/accessibility/attachments.md` with:
- Upload dialog labels, focus management, and status/error messaging.
- Reading pane attach button and hidden file input behavior.
- Attachment rail list semantics, link/delete labels, minimized state, and resize/minimize limitations.
- Preview loading/error semantics and color-not-alone evidence.
- Bilingual delivery N/A rationale.
