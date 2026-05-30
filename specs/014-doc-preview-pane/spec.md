# Feature Specification: Working Doc Preview Pane

**Feature Branch**: `014-doc-preview-pane`

**Created**: 2026-05-29

**Status**: Draft

**Input**: User description: "Add a preview split pane feature to the working doc editor. It doesn't need to be a \"live\" preview but can just update/refresh on doc save UNLESS live update is \"easier\" or \"optimal\""

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Preview Saved Markdown Beside Editor (Priority: P1)

As an authenticated user editing a working document, I want to see a rendered preview beside the markdown source so I can confirm the document's readable form without leaving the editor.

**Why this priority**: A side-by-side preview is the core value of the feature; it reduces context switching and helps users validate formatting while continuing to work in the document editor.

**Independent Test**: Can be fully tested by opening a working document with markdown content, enabling or viewing the preview pane, saving a change, and confirming the preview shows the saved rendered content next to the editor.

**Acceptance Scenarios**:

1. **Given** a working document with markdown content is open in the editor, **When** the user views the editor area, **Then** the document source and rendered preview are both visible in a split-pane layout when there is enough screen space.
2. **Given** a user edits markdown source and saves the document, **When** the save completes successfully, **Then** the preview refreshes to reflect the saved document content.
3. **Given** a document includes common markdown structures such as headings, lists, links, emphasis, block quotes, and code blocks, **When** the preview is shown, **Then** those structures are rendered in a readable form that corresponds to the saved markdown source.

---

### User Story 2 - Keep Editing Usable on Smaller Screens (Priority: P2)

As a user on a narrow or constrained display, I want the preview experience to avoid crowding the editor so I can still read, write, save, and navigate the document comfortably.

**Why this priority**: The feature must improve the editor without making the existing working-document workflow harder on smaller screens, resized windows, or assistive setups.

**Independent Test**: Can be fully tested by opening the editor at desktop and narrow viewport widths, confirming the editor remains usable, and confirming the preview is available without hiding required editing controls.

**Acceptance Scenarios**:

1. **Given** the editor is displayed in a narrow viewport, **When** the user opens or uses a working document, **Then** the layout adapts so the editor remains the primary usable area and required controls are still reachable.
2. **Given** the preview pane is visible, **When** the user navigates with only a keyboard, **Then** focus moves predictably through editor, preview-related controls, and save controls without trapping the user.

---

### User Story 3 - Understand Preview Freshness (Priority: P3)

As a user making unsaved changes, I want to understand whether the preview reflects my saved document or current edits so I do not mistake stale preview content for saved output.

**Why this priority**: The baseline preview may refresh on save rather than on every keystroke, so users need clear feedback about what the preview represents.

**Independent Test**: Can be fully tested by editing a document without saving, observing the preview state or messaging, then saving and confirming the preview state updates.

**Acceptance Scenarios**:

1. **Given** the preview refreshes only after save, **When** the user has unsaved edits, **Then** the interface indicates that the preview may not include those unsaved edits.
2. **Given** the preview updates more frequently than save, **When** the user edits the document, **Then** the preview remains responsive and does not imply unsaved content has been persisted.

---

### Edge Cases

- The document body is empty and the preview has no rendered content to show.
- The document contains malformed or incomplete markdown while the user is drafting.
- The document contains long lines, large sections, or code blocks that could overflow the preview area.
- The user saves while the preview pane is visible and the save fails.
- The user opens a document whose saved content changed since the editor last loaded it.
- The editor is used with keyboard-only navigation, screen readers, high-contrast settings, zoomed text, or reduced viewport width.

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: Authenticated users MUST be able to view a rendered markdown preview for the currently open working document from within the working document editor.
- **FR-002**: The preview MUST be presented in a split-pane experience beside the editor when the available display area can support both panes without hiding required document controls.
- **FR-003**: The preview experience MUST adapt on constrained display areas so users can still edit, save, and navigate the document without horizontal page-level scrolling or inaccessible controls.
- **FR-004**: The preview MUST refresh to match the saved document content after a successful save.
- **FR-005**: The preview MAY refresh before save when doing so preserves editor responsiveness, accessibility, and clear saved-versus-unsaved status.
- **FR-006**: The system MUST clearly communicate when the preview does not include unsaved edits, unless the preview already reflects current edits without implying they are saved.
- **FR-007**: The preview MUST render common markdown content in readable form, including headings, paragraphs, lists, links, emphasis, block quotes, and code blocks.
- **FR-008**: The preview MUST preserve user trust by never modifying the markdown source as a side effect of rendering the preview.
- **FR-009**: Preview failures MUST be communicated with a recoverable message that does not block continued source editing or saving.
- **FR-010**: User-facing preview controls, status text, layout behavior, and focus movement MUST meet WCAG 2.2 AA expectations for keyboard operation, visible focus, labels, contrast, reflow, and status communication.
- **FR-011**: The feature MUST not require bilingual content delivery unless the broader Lattice workbench is configured for multiple languages.

### Key Entities

- **Working Document**: A markdown note managed inside the workbench; includes a title, markdown source, saved state, and last-updated information.
- **Editor Pane**: The source-editing area where users write or revise markdown content and perform save actions.
- **Preview Pane**: The rendered view of the current working document content, with an associated freshness state indicating whether it reflects saved content or current edits.
- **Preview Freshness State**: User-facing status describing whether the preview is current, waiting for save, refreshing, or unable to render.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: In validation testing, 95% of users can identify the rendered preview for an open working document within 5 seconds of opening the editor on a desktop-sized display.
- **SC-002**: After a successful save, the preview reflects the saved markdown content within 2 seconds for documents up to 25,000 characters during normal local use.
- **SC-003**: 100% of acceptance-test documents containing headings, lists, links, emphasis, block quotes, and code blocks render those structures in the preview without altering the source text.
- **SC-004**: Keyboard-only users can move through editor controls, preview controls or status, and save controls without a keyboard trap in 100% of accessibility validation attempts.
- **SC-005**: At narrow viewport widths used in validation, users can continue editing and saving without losing access to required controls or relying on page-level horizontal scrolling.
- **SC-006**: At least 90% of users in task validation correctly understand whether the preview reflects saved content or unsaved edits before completing a save-and-review task.

## Assumptions

- The feature is for authenticated Lattice users already using the working document editor.
- The required baseline is a preview that refreshes after a successful document save; live or near-live refresh is acceptable only if it improves or simplifies the experience without reducing clarity, performance, or accessibility.
- Markdown source editing remains in scope; rich-text editing, collaborative editing, and exporting rendered documents are out of scope for this feature.
- Existing working document creation, editing, saving, and deletion behavior remains unchanged except for the added preview experience.
- Accessibility evidence should be updated under `docs/accessibility/` because this feature changes user-facing editor layout, status communication, and keyboard navigation.
- Bilingual delivery is not required for this feature because the current working document editor and workbench copy are English-only and no multilingual workbench mode is specified.
