# Feature Specification: Attachments

**Feature Branch**: `feature/time-machine-attachments`

**Created**: 2026-05-26

**Status**: Draft

**Input**: User description: "Feature: Attachments. Description: Lets users attach files to captures and working docs, preview them, and include attachment metadata in retrieval. Relevant files: spine/src/routes/attachments.ts, spine/migrations/003_capture_attachments.sql, spine/migrations/008_attachment_upload_source.sql, spine/migrations/009_working_attachments.sql, spine/tests/routes/attachments.test.ts, spine/tests/routes/working-attachments.test.ts, surface/src/lib/api/attachments.ts, surface/src/components/reading/AttachmentRail.svelte, surface/src/components/overlays/FileUpload.svelte, surface/src/components/reading/PdfViewer.svelte. Focus on this feature only; do not modify other features."

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Attach Files to Knowledge Items (Priority: P1)

An authenticated user attaches a local file to an existing capture or working document so the file stays connected to the thought, note, or draft it supports.

**Why this priority**: Without reliable upload and association, attachments cannot support capture review, working documents, or later retrieval.

**Independent Test**: Can be fully tested by attaching a file to a capture and to a working document, then confirming each parent item lists only its own attachment metadata.

**Acceptance Scenarios**:

1. **Given** an existing capture, **When** the user selects a file to attach, **Then** the capture shows the attachment filename, size, type, and creation time.
2. **Given** an existing working document, **When** the user attaches a file, **Then** the working document shows the attachment independently from capture attachments.
3. **Given** a missing parent item, **When** the user attempts to attach a file, **Then** the system rejects the upload with a recoverable not-found outcome.

---

### User Story 2 - Preview and Download Attachments (Priority: P2)

An authenticated user opens an attachment from the reading or editing context to inspect its contents without losing the surrounding workbench context.

**Why this priority**: Attached files only provide value if users can confidently inspect or download them from the item where they were stored.

**Independent Test**: Can be tested by uploading a text file and a PDF-like file, opening the attachment action, and confirming the raw file or preview loads with safe metadata and a clear failure state.

**Acceptance Scenarios**:

1. **Given** an attachment in a visible attachment rail, **When** the user opens it, **Then** the file is served with the original media type and a safe downloadable filename.
2. **Given** a previewable PDF attachment, **When** the user opens the preview, **Then** the user receives a loading state, rendered pages when possible, and a clear error if rendering fails.
3. **Given** an attachment whose file is missing or inaccessible, **When** the user opens it, **Then** the user receives a not-found or forbidden outcome rather than an unrelated item.

---

### User Story 3 - Manage and Retrieve Attachment Metadata (Priority: P3)

An authenticated user can remove obsolete attachments and discover attachment metadata through retrieval so filenames, sizes, media types, and parent context remain findable.

**Why this priority**: Cleanup and retrieval metadata keep attachments from becoming opaque storage blobs.

**Independent Test**: Can be tested by uploading, deleting, and searching for attachment metadata while confirming deleted attachments no longer appear or return raw content.

**Acceptance Scenarios**:

1. **Given** an attached file, **When** the user deletes it, **Then** the attachment disappears from the parent item and cannot be opened afterward.
2. **Given** an uploaded attachment, **When** retrieval is refreshed, **Then** attachment metadata is available for search or related-document discovery.
3. **Given** a deleted attachment, **When** retrieval is refreshed, **Then** stale attachment metadata is no longer returned.

---

### Edge Cases

- Upload body is not valid multipart form data.
- Upload request omits the required file field.
- Capture id or attachment id is not numeric.
- Working document slug is malformed or no longer exists.
- Two parent items have attachments with the same original filename.
- Original filename contains spaces, quotes, path separators, or shell-sensitive characters.
- Attachment file exists in the database but is missing from disk.
- Stored attachment path resolves outside the configured attachment directory or through a symlink loop.
- User deletes an attachment while its preview is open.
- Attachment rail is minimized, resized, empty, loading, or in an error state.
- PDF preview fails because the file is corrupt, encrypted, or not actually a PDF.
- Keyboard and assistive technology users must be able to open, resize/minimize where applicable, and delete attachments without relying on pointer-only interactions.

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: System MUST let authenticated users upload one local file at a time to an existing capture.
- **FR-002**: System MUST let authenticated users upload one local file at a time to an existing working document.
- **FR-003**: System MUST store attachment metadata including parent identity, original filename, media type, size in bytes, storage location, upload source when applicable, and creation time.
- **FR-004**: System MUST list attachments for a parent item in a stable chronological order without mixing attachments from other parents.
- **FR-005**: System MUST provide a safe way to open or download attachment content from the parent item.
- **FR-006**: System MUST prevent raw attachment reads from resolving outside the configured attachment storage area.
- **FR-007**: System MUST return recoverable client-facing errors for missing parents, invalid ids, invalid multipart bodies, missing file fields, missing disk files, and forbidden storage paths.
- **FR-008**: System MUST let authenticated users delete an attachment from a capture or working document.
- **FR-009**: System MUST remove deleted attachments from parent lists and retrieval metadata.
- **FR-010**: System MUST include attachment metadata in retrieval so users can find attached files by filename, parent context, media type, or size-related metadata.
- **FR-011**: System MUST expose attachment controls and status messages in a way that supports keyboard operation, visible focus, screen-reader labels, and WCAG 2.2 AA contrast.
- **FR-012**: System MUST provide clear loading and error states for previewable attachments, including PDF previews.
- **FR-013**: System MUST NOT require bilingual UI or documentation for this feature; English-only labels and accessibility evidence are acceptable for this project phase.

### Key Entities *(include if feature involves data)*

- **Capture Attachment**: A file associated with a capture; key attributes are attachment id, capture id, filename, content type, size, stored path, upload source, and creation time.
- **Working Attachment**: A file associated with a working document; key attributes are attachment id, working document slug, filename, content type, size, stored path, and creation time.
- **Attachment Preview State**: The user-facing state of an attachment view, including loading, ready, empty, failed, and unavailable outcomes.
- **Attachment Retrieval Entry**: Searchable metadata derived from an attachment and its parent context.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: A user can attach a file to a capture or working document and see it in the parent item list in under 10 seconds for files up to typical personal-document size.
- **SC-002**: 100% of invalid parent, invalid id, missing file, and missing disk-file cases produce explicit non-success outcomes without exposing unrelated files.
- **SC-003**: Deleted attachments are absent from parent attachment lists immediately after the delete action completes.
- **SC-004**: Attachment metadata becomes searchable after upload and is removed from search after deletion during automated validation.
- **SC-005**: Keyboard-only users can reach upload, open, minimize or expand, and delete controls with visible focus and no pointer-only requirement.
- **SC-006**: Attachment UI and preview states have documented WCAG 2.2 AA evidence covering labels, focus behavior, status/error messaging, and color-not-alone indicators.

## Assumptions

- Attachments are stored locally under the existing spine-controlled attachment storage directory.
- Uploading multiple files at once is out of scope; users may repeat the single-file flow.
- Inline editing of attachment content is out of scope.
- Virus scanning, OCR, and full text extraction from arbitrary binary files are out of scope unless existing retrieval metadata already captures the relevant fields.
- Existing authenticated user protections apply to all attachment operations; bearer-token agent routes are not expanded by this feature.
- Accessibility evidence should be updated under `docs/accessibility/`; bilingual delivery is not required because the current product surface is English-only.
