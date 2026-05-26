# Feature Specification: Working Docs

**Feature Branch**: `feature/time-machine-working-docs`

**Created**: 2026-05-26

**Status**: Draft

**Input**: User description: "Feature: Working Docs. Description: Lets users create, edit, read, and delete markdown working documents inside the Lattice workbench. Relevant files: spine/src/working.ts, spine/src/routes/working.ts, spine/working/, spine/tests/unit/working.test.ts, spine/tests/routes/working-route.test.ts, surface/src/lib/api/working.ts, surface/src/components/editor/EditorPane.svelte, surface/src/components/editor/VimToggle.svelte, surface/src/components/workbench/PaneRouter.svelte. Focus on this feature only; do not modify other features."

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Create and Save a Working Document (Priority: P1)

As an authenticated user, I want to create a markdown working document from the workbench so I can capture evolving notes that are separate from quick captures and indexed files.

**Why this priority**: Creating and saving a document is the core value of the feature; without it, reading, editing, and deletion have no meaningful object to operate on.

**Independent Test**: Can be fully tested by creating a new document with a title and markdown body, saving it, and confirming it appears in the workbench with the same content when reopened.

**Acceptance Scenarios**:

1. **Given** the user is in the workbench with no draft selected, **When** they create a working document with a title and markdown content, **Then** the document is saved and can be reopened with its content intact.
2. **Given** the user attempts to save a document with an empty title, **When** they submit it, **Then** the system prevents an unusable document name and explains what must be fixed.
3. **Given** the user includes markdown syntax in the body, **When** the document is saved and reopened, **Then** the markdown source is preserved without unexpected rewriting.

---

### User Story 2 - Browse and Read Existing Working Documents (Priority: P2)

As an authenticated user, I want to browse existing working documents and open one for reading so I can quickly resume prior knowledge work.

**Why this priority**: Users need reliable retrieval of their own working notes before edit and cleanup flows are useful.

**Independent Test**: Can be fully tested by seeding multiple documents, listing them in the workbench, and opening each document to confirm the correct title, content, and last-updated information are shown.

**Acceptance Scenarios**:

1. **Given** multiple working documents exist, **When** the user opens the working-documents area, **Then** the documents are listed in a predictable order with enough identifying information to choose the right one.
2. **Given** a listed working document exists, **When** the user selects it, **Then** the workbench displays that document's current title and markdown body.
3. **Given** no working documents exist, **When** the user opens the working-documents area, **Then** they see an empty state that explains how to create the first document.

---

### User Story 3 - Edit and Delete Working Documents (Priority: P3)

As an authenticated user, I want to revise or delete working documents so the workbench stays accurate and uncluttered as my notes evolve.

**Why this priority**: Editing and deletion complete the document lifecycle, but they depend on reliable creation and reading.

**Independent Test**: Can be fully tested by updating a saved document, confirming the update persists, deleting it, and confirming it is no longer listed or openable.

**Acceptance Scenarios**:

1. **Given** an existing working document is open, **When** the user changes the title or markdown body and saves, **Then** the updated document replaces the prior version and records that it changed.
2. **Given** an existing working document is no longer needed, **When** the user confirms deletion, **Then** it is removed from the workbench and cannot be reopened from the document list.
3. **Given** a document was removed or cannot be found, **When** the user tries to open it, **Then** the system reports that it is unavailable without disrupting the rest of the workbench.

---

### Edge Cases

- A document title contains leading/trailing spaces or path-like characters.
- A document body is empty because the user wants a placeholder note.
- A document is edited after another view has stale document metadata.
- A requested document no longer exists on disk or cannot be read.
- A delete action is requested for a missing document.
- The working-documents storage location is unavailable or not writable.
- The editor is used by keyboard-only users or assistive technology users.

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: Authenticated users MUST be able to create a working document with a user-visible title and markdown body.
- **FR-002**: Authenticated users MUST be able to view a list of working documents with at least title, identifier, and last-updated information.
- **FR-003**: Authenticated users MUST be able to open an existing working document and read its current title and markdown source.
- **FR-004**: Authenticated users MUST be able to update an existing working document's title and markdown body.
- **FR-005**: Authenticated users MUST be able to delete an existing working document after an intentional delete action.
- **FR-006**: The system MUST reject document titles that are empty after trimming or unsafe for user-facing identification.
- **FR-007**: The system MUST preserve markdown source text entered by the user, including headings, lists, links, code blocks, and blank lines.
- **FR-008**: The system MUST report missing, unreadable, or unwritable documents with clear recoverable errors.
- **FR-009**: Working document interactions MUST remain available inside the workbench without requiring users to leave their current Lattice session.
- **FR-010**: User-facing controls and states for working documents MUST meet WCAG 2.2 AA expectations for keyboard operation, visible focus, labels, status messages, and contrast.
- **FR-011**: The feature MUST not require bilingual content delivery unless the rest of the Lattice workbench is configured for multiple languages.

### Key Entities

- **Working Document**: A markdown note managed inside the workbench; includes an identifier, title, markdown body, creation time, and last-updated time.
- **Document List Item**: A compact representation of a working document used for browsing and selection; includes enough metadata to distinguish documents without opening each one.
- **Editor State**: The user's current interaction state for a working document, including loaded content, unsaved changes, validation errors, and save/delete status.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: Users can create and reopen a working document with markdown content in under 30 seconds during normal use.
- **SC-002**: 100% of saved markdown documents retain their source content exactly across close and reopen actions in acceptance testing.
- **SC-003**: Users can find and open any one of 50 existing working documents from the workbench in under 10 seconds when they know its title.
- **SC-004**: Document update and delete flows complete successfully in at least 95% of normal-use attempts during validation testing.
- **SC-005**: Keyboard-only users can create, edit, save, and delete a working document without encountering a keyboard trap or unlabeled required control.

## Assumptions

- Working documents are for authenticated Lattice users operating inside their existing workbench session.
- Markdown source editing is in scope; rich-text editing and collaborative multi-user editing are out of scope for this feature.
- Empty document bodies are allowed, but empty or unsafe titles are not.
- Documents are local-first user-controlled content, consistent with Lattice's existing self-hosted storage model.
- Accessibility evidence should be updated under `docs/accessibility/` because this feature adds user-facing editor and workbench interactions.
