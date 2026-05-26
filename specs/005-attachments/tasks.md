# Tasks: Attachments

**Input**: Design documents from `specs/005-attachments/`
**Prerequisites**: `plan.md`, `spec.md`, `research.md`, `data-model.md`, `contracts/attachments.md`, `quickstart.md`

## Phase 1: Setup

- [X] T001 Review existing attachment schema and route coverage in `spine/migrations/003_capture_attachments.sql`, `spine/migrations/008_attachment_upload_source.sql`, `spine/migrations/009_working_attachments.sql`, `spine/tests/routes/attachments.test.ts`, and `spine/tests/routes/working-attachments.test.ts`
- [X] T002 Review existing surface attachment entry points in `surface/src/components/reading/ReadingPane.svelte`, `surface/src/components/reading/AttachmentRail.svelte`, `surface/src/components/overlays/FileUpload.svelte`, and `surface/src/components/reading/PdfViewer.svelte`

## Phase 2: Foundational

- [X] T003 [P] Add shared route test helpers for malformed attachment uploads and auth requests in `spine/tests/routes/attachments.test.ts`
- [X] T004 [P] Add shared route test helpers for malformed working attachment uploads and auth requests in `spine/tests/routes/working-attachments.test.ts`
- [X] T005 [P] Inspect retrieval metadata behavior and stale-hit filtering needs in `spine/src/search.ts`

## Phase 3: User Story 1 - Attach Files to Knowledge Items (P1)

**Goal**: Users can attach one file at a time to captures and working documents and see parent-scoped metadata.

**Independent Test**: Upload one file to a capture and one file to a working document, then confirm each parent list returns only its own metadata.

- [X] T006 [P] [US1] Add capture attachment tests for missing file field and malformed multipart bodies in `spine/tests/routes/attachments.test.ts`
- [X] T007 [P] [US1] Add working attachment tests for missing file field and malformed multipart bodies in `spine/tests/routes/working-attachments.test.ts`
- [X] T008 [US1] Ensure browser capture uploads preserve metadata and parent scoping in `spine/src/routes/attachments.ts`
- [X] T009 [US1] Ensure working document uploads preserve metadata and parent scoping in `spine/src/routes/working.ts`
- [X] T010 [US1] Improve reading-pane attach control labelling and upload status exposure in `surface/src/components/reading/ReadingPane.svelte`
- [X] T011 [US1] Improve standalone upload dialog labels, retry status, and keyboard flow in `surface/src/components/overlays/FileUpload.svelte`

## Phase 4: User Story 2 - Preview and Download Attachments (P2)

**Goal**: Users can safely open/download attachments and receive clear loading/error states for previewable files.

**Independent Test**: Upload a text file and open its raw URL; open a PDF preview path and confirm loading/error states are perceivable.

- [X] T012 [P] [US2] Add raw capture attachment tests for unsafe stored paths, missing disk files, and sanitized filenames in `spine/tests/routes/attachments.test.ts`
- [X] T013 [P] [US2] Add raw working attachment tests for unsafe stored paths, missing disk files, and sanitized filenames in `spine/tests/routes/working-attachments.test.ts`
- [X] T014 [US2] Harden canonical-path checks and response headers for capture raw attachment serving in `spine/src/routes/attachments.ts`
- [X] T015 [US2] Harden canonical-path checks and response headers for working raw attachment serving in `spine/src/routes/working.ts`
- [X] T016 [US2] Add accessible attachment rail semantics, empty/loading/error states, and keyboard-operable controls in `surface/src/components/reading/AttachmentRail.svelte`
- [X] T017 [US2] Add accessible PDF preview loading/error semantics in `surface/src/components/reading/PdfViewer.svelte`

## Phase 5: User Story 3 - Manage and Retrieve Attachment Metadata (P3)

**Goal**: Users can delete obsolete attachments and find attachment metadata through retrieval without stale deleted hits.

**Independent Test**: Upload, search by filename, delete, then confirm the parent list and retrieval metadata no longer expose the deleted attachment.

- [X] T018 [P] [US3] Add capture attachment delete cleanup and retrieval metadata tests in `spine/tests/routes/attachments.test.ts`
- [X] T019 [P] [US3] Add working attachment delete cleanup and retrieval metadata tests in `spine/tests/routes/working-attachments.test.ts`
- [X] T020 [P] [US3] Add stale attachment search-result filtering tests in `spine/tests/routes/search.test.ts`
- [X] T021 [US3] Filter stale capture and working attachment retrieval hits in `spine/src/search.ts`
- [X] T022 [US3] Ensure capture attachment delete removes metadata, binary, index file, and refreshes search in `spine/src/routes/attachments.ts`
- [X] T023 [US3] Ensure working attachment delete removes metadata, binary, index file, and refreshes search in `spine/src/routes/working.ts`
- [X] T024 [US3] Add delete confirmation/status behavior for attachment rail controls in `surface/src/components/reading/AttachmentRail.svelte`

## Phase 6: Polish & Cross-Cutting Concerns

- [X] T025 [P] Document WCAG 2.2 AA evidence and bilingual N/A rationale in `docs/accessibility/attachments.md`
- [X] T026 Run `cd spine && bun test tests/routes/attachments.test.ts tests/routes/working-attachments.test.ts tests/routes/search.test.ts`
- [X] T027 Run `cd surface && bun run check`
- [X] T028 Mark completed tasks in `specs/005-attachments/tasks.md` after verification and queue metadata updates

## Dependencies

- Phase 1 must complete before Phase 2.
- Phase 2 must complete before user-story implementation.
- US1 is the MVP and should complete before US2 and US3.
- US2 and US3 can proceed in parallel after US1 if route-level contracts remain stable.
- Polish tasks run after all selected user stories are implemented.

## Parallel Examples

- US1: T006 and T007 can be written in parallel before T008/T009.
- US2: T012 and T013 can be written in parallel before T014/T015.
- US3: T018, T019, and T020 can be written in parallel before T021-T024.
- Polish: T025 can be drafted while verification commands T026 and T027 run.

## Implementation Strategy

1. Complete setup/foundational review.
2. Deliver US1 as the MVP: parent-scoped upload and list behavior for captures and working documents.
3. Add safe raw serving and accessible preview/rail behavior for US2.
4. Add delete cleanup and stale retrieval filtering for US3.
5. Finish accessibility evidence and run targeted spine/surface checks.
