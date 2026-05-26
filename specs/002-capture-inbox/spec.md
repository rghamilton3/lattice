# Feature Specification: Capture Inbox

**Feature Branch**: `feature/time-machine-capture-inbox`

**Created**: 2026-05-26

**Status**: Draft

**Input**: User description: "Feature: Capture Inbox. Description: Lets users send quick captures into the spine, browse recent captures, and receive live capture updates. Relevant files: spine/src/routes/captures.ts, spine/src/captureEvents.ts, spine/migrations/001_captures.sql, spine/tests/routes/captures.test.ts, surface/src/lib/api/captures.ts, surface/src/components/home/InboxList.svelte, surface/src/components/home/HomeView.svelte, surface/src/components/overlays/QuickCapture.svelte. Focus on this feature only; do not modify other features."

## Clarifications

### Session 2026-05-26

- Q: What maximum length should a single text capture accept? → A: 10,000 characters

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Save A Quick Capture (Priority: P1)

As a Lattice user, I want to send a short note or thought into my inbox without organizing it immediately so I can preserve ideas before they are lost.

**Why this priority**: Quick capture is the entry point for later triage, search, tasks, and working-document flows.

**Independent Test**: Can be fully tested by opening the quick capture entry point, submitting valid text, and confirming the capture appears in the inbox with its content and timestamp.

**Acceptance Scenarios**:

1. **Given** the user is viewing Lattice, **When** they submit a non-empty quick capture, **Then** the capture is saved and shown in the recent inbox.
2. **Given** the user submits a capture with leading or trailing whitespace, **When** the capture is saved, **Then** the meaningful text is preserved without adding blank-only content.
3. **Given** the save fails, **When** the user submits a capture, **Then** the user sees a clear failure state and the original text remains available to retry.

---

### User Story 2 - Browse Recent Captures (Priority: P2)

As a Lattice user, I want to see my recent captures in one inbox view so I can quickly review what has entered the system.

**Why this priority**: A capture is only useful if the user can confirm and revisit it before later processing features exist.

**Independent Test**: Can be tested by creating multiple captures and confirming the inbox lists the newest captures first with enough information to identify each item.

**Acceptance Scenarios**:

1. **Given** multiple captures exist, **When** the user opens the inbox, **Then** captures are listed from newest to oldest.
2. **Given** no captures exist, **When** the user opens the inbox, **Then** the view communicates that the inbox is empty without presenting an error.
3. **Given** capture text is longer than the available display area, **When** it appears in the inbox, **Then** the user can still identify the capture without the layout becoming unusable.

---

### User Story 3 - See Live Capture Updates (Priority: P3)

As a Lattice user, I want new captures to appear in the inbox when they are added from another open surface so I can trust the inbox reflects the current state.

**Why this priority**: Live updates reduce manual refreshing and make capture feel reliable across multiple open windows or entry points.

**Independent Test**: Can be tested by opening the inbox in one view, creating a capture from another view, and confirming the first view updates without a full page reload.

**Acceptance Scenarios**:

1. **Given** the inbox is open, **When** a new capture is added elsewhere, **Then** the inbox includes the new capture without requiring a page reload.
2. **Given** the live update channel is interrupted, **When** the user continues using the inbox, **Then** existing captures remain visible and the user can still refresh or reload to recover.

### Edge Cases

- The user submits empty or whitespace-only capture text.
- The user submits capture text larger than 10,000 characters.
- The inbox is opened before any captures exist.
- Multiple captures are submitted close together and must retain a stable newest-first order.
- The save request succeeds but the live update arrives late or more than once.
- The live update connection disconnects while the user is viewing the inbox.
- A capture contains plain text characters that could be mistaken for markup or commands.

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: The system MUST allow an authenticated user to create a text capture from the quick capture entry point.
- **FR-002**: The system MUST reject empty or whitespace-only captures without losing the user's draft text.
- **FR-003**: The system MUST reject captures longer than 10,000 characters without losing the user's draft text.
- **FR-004**: The system MUST store each capture with a unique identity, text content, creation time, and inbox-visible status.
- **FR-005**: The system MUST list recent inbox captures in newest-first order.
- **FR-006**: The system MUST provide a clear empty state when no captures are available.
- **FR-007**: The system MUST make newly created captures visible in open inbox views without requiring a full page reload when live updates are available.
- **FR-008**: The system MUST keep the inbox usable when live updates are unavailable or interrupted.
- **FR-009**: The system MUST prevent unauthenticated users from creating or reading captures.
- **FR-010**: The system MUST present save, loading, empty, and failure states in language understandable to a self-hosting user.
- **FR-011**: The system MUST preserve local-first operation by storing captures under the operator-controlled Lattice storage boundary.
- **FR-012**: The system MUST keep capture inbox responsibilities limited to creating, listing, and announcing captures; triage, search indexing, promotion, tasks, and attachment behavior remain outside this feature.

### Key Entities *(include if feature involves data)*

- **Capture**: A user-entered inbox item containing text content, creation time, unique identity, and a status indicating it is still in the inbox.
- **Inbox**: The user's recent collection of captures awaiting later review or processing.
- **Live Capture Update**: A notification that a capture has been created and should be reflected in open inbox views.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: A user can save a valid quick capture and see it in the inbox in under 5 seconds during normal local operation.
- **SC-002**: 100% of empty or whitespace-only submissions are rejected without creating an inbox item.
- **SC-003**: 100% of submissions over 10,000 characters are rejected without creating an inbox item.
- **SC-004**: The inbox correctly displays at least the 50 most recent captures in newest-first order.
- **SC-005**: Open inbox views show newly created captures without a full page reload in at least 95% of normal same-instance update attempts.
- **SC-006**: 100% of unauthenticated create or read attempts are denied without exposing capture content.
- **SC-007**: Users can understand whether the inbox is loading, empty, saving, failed, or populated from visible state text alone.

## Assumptions

- Target users are authenticated self-hosting Lattice users operating a personal knowledge instance.
- Captures are plain text in this feature; file uploads, attachments, markdown editing, search indexing, task creation, and triage outcomes are handled by later features.
- Recent inbox browsing is sufficient for this feature; archival filtering, pagination beyond the recent set, and bulk management are outside scope.
- Accessibility governance: WCAG 2.2 AA applies to the quick capture and inbox UI states, including keyboard operation, focus handling, visible labels, error messaging, and non-color-only status communication.
- Accessibility evidence should be updated if implementation adds or materially changes an interactive surface workflow.
- Bilingual delivery is not required because no multilingual content requirement has been identified for the capture inbox.
