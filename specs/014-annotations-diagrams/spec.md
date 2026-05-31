# Feature Specification: Annotations and Diagram Authoring

**Feature Branch**: `014-annotations-diagrams`

**Created**: 2026-05-29

**Status**: Draft

**Input**: User description: "phase 7 of @docs/lattice-development-plan.md"

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Comment on Any Passage (Priority: P1)

As the Lattice user, I want to highlight a passage in any readable item and attach my own comment, so that thoughts created while reading become part of the permanent knowledge record instead of staying in my head or in a separate note.

**Why this priority**: This is the core shift from a read-only surface to an active thinking surface. Without this, the feature does not deliver its main value.

**Independent Test**: Can be fully tested by opening each supported content type, selecting text, saving a comment, leaving the item, returning to it, and confirming the annotation remains visible and correctly attached.

**Acceptance Scenarios**:

1. **Given** a readable capture with selectable text, **When** the user highlights a passage and saves a comment, **Then** the passage is visually marked and the comment is visible beside or near the source passage.
2. **Given** a local indexed file, working doc, or archived web page, **When** the user saves an annotation on selected text, **Then** the annotation is preserved for that specific item without changing the source text.
3. **Given** an annotated item has been closed and reopened, **When** the item is displayed again, **Then** previously saved annotations appear in the expected locations with their comments.
4. **Given** the user navigates with keyboard only, **When** they select text and create a comment, **Then** the full annotation flow is usable without requiring a mouse.

---

### User Story 2 - Find Annotated Material Through Search (Priority: P2)

As the Lattice user, I want searches for words I wrote in annotations to return the original annotated item, so that my own interpretations become retrieval hooks for the underlying source.

**Why this priority**: Annotation is only useful if comments participate in the same retrieval loop as captured and indexed content.

**Independent Test**: Can be tested by creating a comment with a distinctive phrase, searching for that phrase, and confirming the search result leads to the annotated source item and exposes the relevant annotation context.

**Acceptance Scenarios**:

1. **Given** an annotation contains a distinctive phrase not present in the source item, **When** the user searches for that phrase, **Then** the annotated source item appears in the search results.
2. **Given** a search result was matched because of an annotation, **When** the user opens the result, **Then** the user can see which annotation made the item relevant.
3. **Given** an annotation is deleted, **When** the user later searches for text that only existed in that annotation, **Then** that deleted annotation no longer causes the original item to appear.

---

### User Story 3 - Author Mermaid Diagrams in Working Docs (Priority: P3)

As the Lattice user, I want to insert and edit text-based Mermaid diagrams inside working docs with a live visual preview, so that relationships and flows can be captured alongside prose without leaving the writing surface.

**Why this priority**: Diagram authoring expands working docs from prose-only notes into structured thinking artifacts, but it depends on the existing working-doc workflow and is less fundamental than annotations.

**Independent Test**: Can be tested by inserting a diagram into a working doc, editing its source text, and confirming the rendered visual updates while the diagram source remains part of the document.

**Acceptance Scenarios**:

1. **Given** a working doc is open for editing, **When** the user chooses to insert a diagram, **Then** the document receives an editable Mermaid diagram block with a visible preview area.
2. **Given** a working doc contains a valid Mermaid diagram, **When** the user views the doc, **Then** the diagram renders inline as a visual diagram while preserving the underlying text source for editing and search.
3. **Given** a Mermaid diagram contains invalid syntax, **When** the preview cannot render it, **Then** the user sees a clear non-destructive error state and can continue editing the source text.
4. **Given** the user navigates with keyboard only, **When** they insert, edit, and preview a diagram, **Then** each step remains operable without pointer-only controls.

### Edge Cases

- If source content changes after an annotation is created, the saved selected text remains available for context even when exact placement cannot be restored.
- If a user selects no text or only whitespace, the system prevents saving an empty-target annotation and explains what is needed.
- If overlapping annotations exist on the same passage, each comment remains distinguishable and accessible without obscuring the source text.
- If an annotation comment is empty, the system prevents saving it and preserves the user's selected passage.
- If a supported item is temporarily unavailable, annotations already saved for that item are not lost.
- If a rendered diagram is too large for the visible area, the user can still inspect it without breaking the surrounding document flow.
- If assistive technology is used, annotation highlights, marginal notes, popup controls, and diagram previews expose meaningful names, relationships, and keyboard focus order.

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: Users MUST be able to create an annotation by selecting text in a supported item and saving a non-empty comment.
- **FR-002**: The system MUST support annotations on captures, local indexed files, working docs, and archived web pages.
- **FR-003**: The system MUST preserve, for each annotation, the target item, selected passage location when available, selected text, comment text, creation time, and last update time.
- **FR-004**: The system MUST display saved annotations inline with the source item using a visible passage highlight and an associated note.
- **FR-005**: Users MUST be able to delete an annotation they no longer want retained.
- **FR-006**: The system MUST not modify the underlying source content when a user creates, views, or deletes an annotation.
- **FR-007**: The system MUST make annotation comments discoverable through the same search experience used for source content.
- **FR-008**: Search results matched by annotation text MUST lead users back to the annotated source item and provide enough context to identify the matching annotation.
- **FR-009**: Users MUST be able to insert a Mermaid diagram into a working doc as editable text.
- **FR-010**: The system MUST render valid Mermaid diagrams inline in working docs while keeping their source text editable and searchable.
- **FR-011**: The system MUST show a clear, non-destructive error state when a diagram cannot be rendered.
- **FR-012**: Annotation creation, annotation viewing, annotation deletion, diagram insertion, diagram editing, and diagram preview MUST be keyboard operable and meet WCAG 2.2 AA expectations for user-facing controls and content.
- **FR-013**: The system MUST avoid guilt, backlog, streak, overdue, or urgency framing in annotation and diagram workflows.
- **FR-014**: The system MUST keep this phase limited to text annotations and Mermaid diagram authoring; freeform canvas, image annotation, and raster-image OCR are excluded.

### Key Entities *(include if feature involves data)*

- **Annotation**: A user-authored comment attached to a selected passage in a supported source item. Key attributes include target item identity, selected passage location when available, selected text, comment text, creation time, and last update time.
- **Annotation Target**: A source item that can receive annotations. Supported target categories are captures, local indexed files, working docs, and archived web pages.
- **Diagram Block**: A text-based Mermaid diagram embedded in a working doc. It is part of the document content, has editable source text, and can be rendered as an inline visual preview.
- **Search Result Context**: The explanation or snippet that helps the user understand whether a result matched source content, annotation text, or diagram source text.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: The user can create and revisit an annotation on each supported content type in under 30 seconds per item during manual validation.
- **SC-002**: 100% of saved annotations remain visible after closing and reopening the annotated item during acceptance testing.
- **SC-003**: A search for a distinctive phrase used only in an annotation returns the annotated source item within the normal search result set in at least 95% of validation attempts.
- **SC-004**: The user can insert a valid Mermaid diagram into a working doc and see an inline rendered preview in under 60 seconds.
- **SC-005**: Invalid diagram source never causes loss of the user's diagram text in validation testing.
- **SC-006**: Keyboard-only testing can complete the primary annotation and diagram authoring flows with no pointer-only steps.
- **SC-007**: Accessibility review finds no known WCAG 2.2 AA blockers in annotation controls, annotation display, diagram insertion, or diagram preview.

## Assumptions

- The target user is the existing single Lattice user working in the authenticated desktop surface.
- Existing readable item views and working-doc editing flows remain the entry points for this feature.
- Working docs are the only authoring surface for diagrams in this phase.
- Annotation comments are part of the user's owned content and should be retained until the user deletes them.
- Exact annotation placement is best-effort when source text changes, but the selected text is retained to preserve context.
- Bilingual delivery is not required for this personal system unless a future project policy adds that requirement.
- Dedicated `docs/accessibility/` evidence updates are not required at specification time; accessibility expectations are captured here and should be verified during implementation review.
