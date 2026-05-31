# Quickstart: Validate Annotations and Diagram Authoring

## Prerequisites

- Start Lattice with the normal local development workflow.
- Ensure `spine` applies migrations, including `spine/migrations/012_annotations.sql` after implementation.
- Use the authenticated Surface dev path so `/api/*` requests include the dev Authentik header.

## Annotation Flow

1. Open a capture with selectable text.
2. Select a non-empty passage using keyboard or pointer.
3. Create an annotation with a distinctive comment phrase.
4. Confirm the passage has a visible highlight and an associated note.
5. Close and reopen the capture; confirm the annotation remains visible.
6. Repeat for a local indexed file, a working doc, and an archived page.
7. Delete one annotation and confirm it disappears without changing the source text.

## Search Flow

1. Search for the distinctive phrase used only in an annotation.
2. Confirm the annotated source item appears in the normal search results.
3. Open the result and confirm the matching annotation context is visible.
4. Search for text from a deleted annotation and confirm it no longer returns that deleted annotation as a match.

## Diagram Flow

1. Open a working doc in the editor.
2. Use the insert diagram control from the keyboard.
3. Confirm a fenced `mermaid` block is inserted as editable text.
4. Enter a valid Mermaid diagram and confirm the viewer renders it inline.
5. Enter invalid Mermaid syntax and confirm a clear error appears without losing the source text.
6. Search for a distinctive node label from the Mermaid source and confirm the working doc can be found.

## Accessibility Validation

1. Complete annotation creation, deletion, diagram insertion, and diagram preview with keyboard only.
2. Confirm focus indicators are visible throughout popups, notes, editor controls, and preview/error regions.
3. Confirm annotation highlights do not rely on color alone and expose meaningful accessible names or descriptions.
4. Confirm invalid-selection and invalid-diagram errors are announced or reachable by assistive technology.

## Expected Verification Commands

```bash
cd spine && bun test
cd surface && bun run test
just lint
just check
```
