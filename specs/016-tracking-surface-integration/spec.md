# Feature Specification: Tracking Surface Integration

**Feature Branch**: `016-tracking-surface-integration`

**Created**: 2026-06-02

**Status**: Draft

**Input**: User description: "phase 4 of @docs/tracking-development-plan.md"

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Search And Review Tracked Items (Priority: P1)

As a user trying to find something, I want tracking search to live in the main Lattice surface so I can ask where an item is, see the most likely current answer, and review older matching records without leaving the surface.

**Why this priority**: This replaces the side-channel lookup flow and makes tracking useful as a first-class retrieval tool.

**Independent Test**: Can be fully tested by searching for an item with multiple prior tracking records and confirming the user can identify the current best answer, its age, its origin context, any available photo, and relevant history from the surface alone.

**Acceptance Scenarios**:

1. **Given** tracked records exist for an item, **When** the user searches for that item, **Then** the surface shows a clear top match before older history.
2. **Given** a result has origin context or a photo, **When** it appears in search results, **Then** the user can see the origin context and photo preview without opening a separate tool.
3. **Given** the user opens a tracking result, **When** the reading view loads, **Then** the user sees the selected record, other history that appears to mention the same item, and related records from the same location context.

---

### User Story 2 - Track From The Surface (Priority: P2)

As a user already in the surface, I want to add a new tracking record with text and an optional photo so I can record a location without switching to voice, phone, or command-line workflows.

**Why this priority**: The surface must become a complete tracking entry point, not only a place to read tracking data.

**Independent Test**: Can be fully tested by creating a new tracking record from the surface, optionally including a photo, then immediately finding that record through tracking search and history.

**Acceptance Scenarios**:

1. **Given** the user is viewing the tracking area, **When** they submit a text-only tracking entry, **Then** the new entry is saved and appears in subsequent search and history views.
2. **Given** the user attaches a photo to a tracking entry, **When** they submit it, **Then** the entry preserves the photo association and the photo is visible wherever photo previews are expected.
3. **Given** the user submits an empty tracking entry, **When** validation runs, **Then** the user receives a clear message and no blank record is created.

---

### User Story 3 - Reorganize Items On A Board (Priority: P3)

As a user doing a bulk relocation or visual review, I want a board of tracked item cards grouped into free-text location bins so I can move cards between bins and have those moves become part of the tracking history.

**Why this priority**: The board supports bulk and visual workflows that voice tracking cannot handle efficiently, especially when many items move at once.

**Independent Test**: Can be fully tested by creating bins, viewing item cards, moving a card between bins, and confirming the move is reflected as the item's current location while previous records remain available as history.

**Acceptance Scenarios**:

1. **Given** tracked items exist, **When** the board opens, **Then** each recognizable current item appears as one card in a single bin or in an unbinned area.
2. **Given** the user creates a new bin name, **When** the bin is accepted, **Then** it becomes available for organizing cards without requiring a predefined category list.
3. **Given** a card is moved from one bin to another, **When** the move completes, **Then** the card's current location changes to the destination bin and the prior location remains visible through history.
4. **Given** an item is marked as away from its expected place, **When** it appears on the board, **Then** it has a visible and non-color-only displaced indicator and can be filtered from the board header.

---

### User Story 4 - Resolve Tracking Follow-Ups (Priority: P4)

As a user returning to the surface after looking up an item, I want pending tracking follow-ups to appear in the same surface context as other actionable items so I can confirm that an item is still there, record where it moved, or skip the follow-up without creating backlog.

**Why this priority**: Follow-ups close the loop after retrieval and keep the tracking system accurate without behaving like accumulating obligations.

**Independent Test**: Can be fully tested by preparing a pending follow-up, viewing it in the surface, selecting each available action path, and confirming the prompt is resolved appropriately.

**Acceptance Scenarios**:

1. **Given** a pending follow-up exists for a non-displaced item, **When** the user views it, **Then** the affirmative action reads naturally as confirming the item is still there.
2. **Given** a pending follow-up exists for a displaced item, **When** the user views it, **Then** the affirmative action reads naturally as confirming the item is still out.
3. **Given** the user chooses to record a moved item, **When** the tracking flow opens, **Then** the new record is associated with the previously opened record and the follow-up is resolved.
4. **Given** the user skips a follow-up, **When** the skip completes, **Then** the prompt disappears and does not accumulate as an outstanding obligation.

### Edge Cases

- Search results can include several similar item phrases; the surface must make recency and history clear enough for the user to choose without implying false certainty.
- Searches with no exact match must avoid a dead end by showing useful adjacent results or a clear empty state that invites a new tracking entry.
- Records with photos that are missing, unavailable, or slow to load must still leave the text record usable.
- Items that cannot be confidently associated with a bin must remain reachable in an unbinned area rather than disappearing.
- Multiple item phrases that appear to refer to the same thing may appear separately until the user explicitly merges them; moving a card must never merge item identities by accident.
- A board move that fails to save must leave the user with a clear recovery path and must not falsely show the new location as authoritative.
- Keyboard-only and assistive-technology users must be able to search, open records, create tracks, manage bins, move items, use filters, and resolve follow-ups.
- Narrow screens must preserve access to search, board, form, and follow-up interactions without requiring horizontal scrolling for primary controls.

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: The system MUST provide a tracking search area in the main surface where users can enter natural-language item or location questions.
- **FR-002**: The system MUST show a top tracking result separately from older matching history whenever matching records exist.
- **FR-003**: Search results MUST show user-meaningful context for each record, including when it was captured, where it came from when available, whether it is displaced, and whether a photo is attached.
- **FR-004**: Users MUST be able to open a tracking record into a reading view that includes the selected record, history that appears to mention the same item, and related records from the same location context.
- **FR-005**: Tracking records MUST be reachable through stable item-history links so users can return to a specific record from browser history, saved links, or follow-up prompts.
- **FR-006**: Users MUST be able to create a new tracking record from the surface using free-form text.
- **FR-007**: Users MUST be able to attach an optional photo to a surface-created tracking record, and records with photos MUST expose a preview in search and reading contexts.
- **FR-008**: Surface-created tracking records MUST be distinguishable from records created through other tracking paths when users review history.
- **FR-009**: The system MUST provide a board view that presents tracked item cards grouped by free-text location bins.
- **FR-010**: The system MUST derive item cards from existing tracked records and show each current item in exactly one board location: a matching bin, an unbinned area, or a clearly defined displaced presentation.
- **FR-011**: Users MUST be able to create bins manually from free-text names.
- **FR-012**: Users MUST be able to create a bin from an existing visible location phrase without requiring a predefined taxonomy.
- **FR-013**: Moving an item card from one bin to another MUST create a new current location for that item while preserving older records as history.
- **FR-014**: Moving an item card into a bin MUST mark the item as no longer displaced because the user is placing it into a defined location.
- **FR-015**: Users MUST be able to explicitly mark an item as displaced from the board and include free-form context for why or where it is away.
- **FR-016**: Displaced items MUST have a visible indicator that does not rely on color alone, and users MUST be able to filter the board to displaced items only.
- **FR-017**: The system MUST prevent drag or move gestures from merging item identities; merging similar items, if offered, MUST be a separate confirmed action.
- **FR-018**: Pending tracking follow-ups MUST appear in the surface as dismissible action items with options to confirm the record is still accurate, record a moved location, or skip.
- **FR-019**: Follow-up affirmative wording MUST reflect whether the opened tracking record is displaced or not.
- **FR-020**: Resolving or skipping a follow-up MUST prevent that follow-up from reappearing as a backlog item.
- **FR-021**: The surface MUST preserve append-only tracking behavior: corrections, moves, and checkouts are represented as new records, not edits to older records.
- **FR-022**: The feature MUST meet WCAG 2.2 AA expectations for keyboard operation, visible focus, non-color-only state, status messaging, readable contrast, and responsive reflow across the tracking search, form, board, and follow-up interactions.
- **FR-023**: User-facing tracking copy MUST be plain English, concise, and understandable without technical vocabulary.

### Key Entities *(include if feature involves data)*

- **Tracking Record**: A historical statement about an item, location, or checkout state. It includes free-form text, capture timing, source context, optional photo association, displaced state, and optional relationship to a prior record.
- **Tracked Item Card**: The board representation of the user's current understanding of an item. It is derived from tracking history, has one current location presentation, and links back to the item's history.
- **Bin**: A user-created free-text location grouping such as a desk, drawer, shelf, or pegboard. Bins are created when useful rather than chosen from a predefined taxonomy.
- **Follow-Up Prompt**: A dismissible action item created after retrieval that asks whether the opened record is still accurate, moved, or should be skipped.
- **Tracking Photo**: An optional image associated with a tracking record to help users recognize a location or item.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: Users can find the current best-known location for a previously tracked item from the surface in under 30 seconds in 90% of representative searches.
- **SC-002**: Users can open a tracking record and understand its current answer plus older history without leaving the surface in under 45 seconds.
- **SC-003**: Users can create a text-only tracking record from the surface in under 20 seconds, excluding the time spent composing the text.
- **SC-004**: Users can create a bin and move an item card into it in under 60 seconds during a board review.
- **SC-005**: After a board move, 100% of tested moved items show the destination bin as the current location while retaining access to prior history.
- **SC-006**: Users can identify displaced items at a glance and filter to only displaced items in under 10 seconds.
- **SC-007**: Users can resolve a pending tracking follow-up in one decision step, and resolved or skipped prompts do not reappear in subsequent follow-up views.
- **SC-008**: Keyboard-only users can complete the primary search, create-track, board-move, displaced-filter, and follow-up-resolution flows without blocked controls or focus traps.
- **SC-009**: On narrow screens, all primary tracking interactions remain usable without page-level horizontal scrolling.
- **SC-010**: In usability review, at least 80% of observed tracking interactions choose the surface search or board over direct lookup side channels when the surface is available.

## Assumptions

- Phase 4 builds on the prior tracking substrate: records, search, query history, displaced state, optional photos, and loop-closure follow-ups already exist or are planned inputs.
- The target user is the existing Lattice user managing personal item-location memory, not a multi-user household inventory team.
- The board may initially show imperfect item derivation, including near-duplicates, as long as duplicates are visible, recoverable, and never merged without confirmation.
- A single current location presentation is preferred over multi-bin membership because the newest tracking record is the user's current answer.
- Displaced items will appear either in their last-known location with a strong indicator or in a dedicated displaced area; planning may choose whichever presentation is clearer in design review.
- Bilingual delivery is not required for this feature because the current product surface and provided tracking plan use English-only copy and no multilingual delivery requirement was supplied.
- Accessibility evidence should be updated during implementation because this feature changes browser UI flows with search, forms, board movement, filters, status indicators, and action rows.
