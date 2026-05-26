# Feature Specification: Web Archival And Inbox Evolution

**Feature Branch**: `011-web-archival-inbox`

**Created**: 2026-05-26

**Status**: Draft

**Input**: User description: "Web archival and inbox evolution. Web content becomes a first-class content category. The inbox absorbs failed/degraded archive recapture and recently captured archive review without becoming a parallel queue system. Notifications use the Signal relay for attention only; pending-action state stays in the surface."

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Save Durable Web Pages (Priority: P1)

As a Lattice user, I want saved web pages to be preserved as durable archived content, not just URL references, so I can find and read them years later even if the original site changes or disappears.

**Why this priority**: Durable web capture is the core value of this feature. Without a stored artifact and searchable extracted text, web content is not a first-class category.

**Independent Test**: Can be fully tested by saving a normal web page from a URL-only context and saving a rendered page from a desktop browser, then verifying each saved item has a stored artifact, title or URL fallback, extracted searchable text, source metadata, and appears in search results when technically usable.

**Acceptance Scenarios**:

1. **Given** the user submits a URL from a phone, hotkey, or scripted source, **When** the capture completes successfully, **Then** the page is stored as a durable archive with searchable text and enough metadata to identify where it came from.
2. **Given** the user saves a fully rendered page from a desktop browser, including a page that may require login or browser-side rendering, **When** the capture is accepted, **Then** the rendered archive is stored and indexed as the authoritative good capture for that URL.
3. **Given** the original source URL later becomes unavailable, **When** the user searches for or opens the saved web page, **Then** the archived artifact and extracted text remain available from Lattice.
4. **Given** a user provides an optional one-line reason while saving, **When** the archive is later viewed or reviewed, **Then** that reason is preserved with the archived item.

---

### User Story 2 - Recover Failed Or Degraded Archives (Priority: P2)

As a user, I want technically failed or degraded web captures to appear in the existing inbox with clear recapture actions so I can fix important pages without managing a separate queue.

**Why this priority**: URL-only capture will be imperfect for modern web pages. The feature must turn degraded captures into recoverable work without hiding them or creating new backlog pressure.

**Independent Test**: Can be tested by saving a URL that produces a failed or degraded archive, confirming it appears as an inbox item with recapture, delete, and skip actions, then replacing it with a good rendered capture that supersedes the degraded one without deleting the older artifact.

**Acceptance Scenarios**:

1. **Given** a URL-only capture produces suspiciously little usable content or a clear browser-rendering failure marker, **When** classification completes, **Then** the archive is marked degraded or failed and appears in the inbox as a recapture item.
2. **Given** a recapture item is visible in the inbox, **When** the user chooses Re-capture, **Then** the original URL opens for browser capture and the inbox keeps the pending item until a replacement is saved or the user chooses another action.
3. **Given** a good rendered capture is saved for a URL with an existing degraded archive, **When** the replacement is accepted, **Then** the old archive is retained for traceability but no longer appears as the current search result.
4. **Given** a recapture item is not worth keeping, **When** the user chooses Delete, **Then** the archive is removed from active review and search.
5. **Given** the user is unsure, **When** they choose Skip, **Then** the item leaves the immediate decision flow without being treated as completed, overdue, or failed by the user.

---

### User Story 3 - Review Recent Successful Captures Calmly (Priority: P3)

As a user, I want recently successful web captures to appear briefly in the existing inbox for optional light review, without pings or debt-like pressure, so I can correct mistakes when useful and ignore routine saves when not.

**Why this priority**: Successful captures sometimes need quick triage, but making every capture urgent would undermine the calm surface posture.

**Independent Test**: Can be tested by saving a good archive, confirming it appears in the inbox during the review window with keep, archive, recapture, and skip actions, confirming no attention message is sent under the default notification posture, and confirming it automatically leaves review after inactivity.

**Acceptance Scenarios**:

1. **Given** a good archive was captured recently, **When** the user opens the inbox during the review window, **Then** the item appears as recently captured with positive action verbs and no required decision language.
2. **Given** a recently captured item sits untouched for the configured settling period, **When** the period expires, **Then** the item is automatically treated as kept and leaves the review surface.
3. **Given** the user chooses Re-capture for a successful but imperfect archive, **When** a better rendered capture is saved, **Then** the newer capture becomes current and the older one is retained as superseded history.
4. **Given** notification posture is Standard, **When** a successful recent capture enters review, **Then** no attention message is sent solely for that optional review.

---

### User Story 4 - Route Attention Without Moving State Out Of Surface (Priority: P4)

As a user, I want attention messages only when action is genuinely needed, and I want pending state to remain in the surface, so notifications help me notice important work without becoming another task system.

**Why this priority**: The attention channel must reinforce the surface rather than compete with it. Notification posture is part of the user experience, not just delivery plumbing.

**Independent Test**: Can be tested by changing notification posture, creating recapture and recently captured items, and verifying which events send attention messages, which remain only in the surface, and whether messages include enough context for phone-side action when possible.

**Acceptance Scenarios**:

1. **Given** notification posture is Quiet, **When** recapture or review items are created, **Then** no attention messages are sent and all state waits in the surface.
2. **Given** notification posture is Standard, **When** a recapture item enters the inbox, **Then** an attention message is sent with title or URL, item type, and useful action context.
3. **Given** notification posture is Standard, **When** a recently captured item enters optional review, **Then** no attention message is sent.
4. **Given** notification posture is Active, **When** a recently captured item enters optional review, **Then** an attention message may be sent with enough context to understand the item from the phone.
5. **Given** routine indexing, synchronization, resurfacing, or successful background processing occurs, **When** no user decision is needed, **Then** no attention message is sent.

---

### Edge Cases

- A URL is unreachable, redirects repeatedly, times out, requires authentication, or blocks automated fetching.
- A URL-only capture stores a technically valid page that is editorially low quality; it remains technically good unless capture quality failed.
- A page is mostly an empty app shell, contains browser-rendering-required markers, or produces suspiciously short extracted text.
- A rendered browser capture arrives for a URL that already has one or more degraded or superseded archives.
- Two captures for the same URL arrive close together from different sources.
- A saved page has no title, has a very long title, changes canonical URL during capture, or has duplicate content under different URLs.
- Archive file storage succeeds but text extraction or indexing fails.
- A user deletes a degraded archive that already has a newer good replacement.
- The inbox contains captures, recapture items, and recent archive review items at the same time.
- Keyboard shortcuts conflict with text entry, browser shortcuts, or assistive technology.
- The attention relay is unavailable, delayed, rate-limited, or suppressed by posture.
- The user acts from a phone when the available action requires desktop browser recapture.

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: The system MUST treat archived web pages as a first-class content category alongside owned content and locally indexed content.
- **FR-002**: The system MUST store durable web archive artifacts, not only source URLs, for every accepted web capture attempt that produces recoverable bytes.
- **FR-003**: The system MUST preserve source URL, title or title fallback, capture time, capture method, artifact identity, archive location, extracted text, source context, optional save reason, technical quality, and supersession relationship for archived web pages.
- **FR-004**: Users MUST be able to save a web page from a rendered desktop browser context.
- **FR-005**: Users MUST be able to save a web page by submitting only a URL from contexts such as phone share, hotkey, or automation.
- **FR-006**: The system MUST classify URL-only capture output as good, degraded, or failed based on technical capture quality, not based on whether the content is worth reading.
- **FR-007**: The system MUST identify common degraded capture signals, including suspiciously short extracted text, browser-rendering-required messages, and mostly empty application-shell pages.
- **FR-008**: The system MUST prefer good, non-superseded archives in normal search and retrieval results by default.
- **FR-009**: The system MUST retain superseded archives unless the user explicitly deletes them.
- **FR-010**: When a good rendered capture is saved for a URL with an existing degraded or failed archive, the system MUST make the new capture current and mark the older archive as superseded.
- **FR-011**: Failed or degraded archives MUST appear in the existing inbox as recapture items, not in a separate queue.
- **FR-012**: Recapture inbox items MUST offer Re-capture, Delete, and Skip actions using positive action labels and keyboard shortcuts.
- **FR-013**: Recently successful archives MUST appear in the existing inbox during a bounded optional review window.
- **FR-014**: Recently captured inbox items MUST offer Keep, Archive, Re-capture, and Skip actions using positive action labels and keyboard shortcuts.
- **FR-015**: Recently captured items MUST automatically leave optional review as kept after a settling period if the user takes no action.
- **FR-016**: The inbox model MUST distinguish item types so action rows, labels, shortcuts, and outcomes can vary by item type while preserving one shared inbox experience.
- **FR-017**: The shared action-row interaction MUST use verbs rather than dismissive close labels, be keyboard-first, support mouse use, and always provide Skip as a deferred non-decision.
- **FR-018**: The surface MUST avoid urgency theater for archive review, including streaks, overdue language, and count displays that imply debt rather than useful judgment.
- **FR-019**: The attention relay MUST send messages for recapture items when notification posture allows actionable alerts.
- **FR-020**: The attention relay MUST NOT send messages for recently captured optional review items under the default notification posture.
- **FR-021**: Notification posture MUST meaningfully affect attention relay behavior and surface prominence: Quiet suppresses relay messages, Standard alerts only for true actionable items, and Active may alert for optional recent-capture review.
- **FR-022**: Attention messages MUST include enough context to understand and act where possible, including title or URL, item type, and action context.
- **FR-023**: Pending-action state MUST remain in the surface; attention messages MUST NOT become the authoritative queue or source of completion state.
- **FR-024**: Routine indexing, synchronization, resurfacing, and successful background processing MUST NOT send attention messages unless user input is needed.
- **FR-025**: Mobile URL saves MUST remain supported even when the resulting capture is degraded and requires later desktop recapture.

### Key Entities

- **Web Archive**: A durable saved representation of a web page, including source URL, metadata, stored artifact, extracted text, technical quality, source context, optional save reason, and current or superseded status.
- **Capture Attempt**: A user- or system-initiated attempt to preserve a web page from either a rendered browser context or a URL-only context.
- **Technical Quality**: The capture pipeline's assessment of whether the archive artifact is usable; it does not represent the user's editorial judgment of content value.
- **Supersession Relationship**: A link from an older archive to a newer archive that replaces it as the current result while retaining historical artifacts.
- **Inbox Item**: A surface item that represents a user-facing decision or optional review, with a discriminator for capture, recapture, and recently captured archive types.
- **Action Row**: A reusable set of positive action verbs and shortcuts attached to an inbox item type.
- **Notification Posture**: The user's attention setting that controls how aggressively the system surfaces actionable items outside the surface.
- **Attention Message**: A context-rich phone-delivered notification that points to action in the surface without owning pending state.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: A user can save a URL from a phone or URL-only source and later find the archived content through normal search, even if the source URL is unavailable during verification.
- **SC-002**: A user can save a browser-rendered page from desktop and retrieve a good archived artifact for a page that would not be adequately captured from URL-only input.
- **SC-003**: At least three degraded URL-only capture patterns are detected and routed to recapture review without being shown as normal good search results.
- **SC-004**: A degraded archive can be replaced by a good rendered capture in one recapture flow, with the older artifact retained and hidden from default current search results.
- **SC-005**: Recapture items appear in the inbox with Re-capture, Delete, and Skip actions and send an attention message under Standard notification posture.
- **SC-006**: Recently captured good archives appear in the inbox during the review window, send no attention message under Standard posture, and auto-promote without user action after the settling period.
- **SC-007**: Quiet, Standard, and Active notification postures produce observably different relay behavior for recapture and recently captured review items.
- **SC-008**: Keyboard users can complete recapture, delete, keep, archive, and skip decisions without using a mouse.
- **SC-009**: No inbox copy, count, or review state describes archive review as overdue, streak-based, or debt-like.

## Assumptions

- Existing authentication and trusted-capture access patterns remain in place.
- Desktop browser capture is the preferred path for pages that require login, client-side rendering, or user-specific rendered state.
- Mobile capture is URL-only for this phase; degraded mobile captures are acceptable if they are recoverable through later desktop recapture.
- Technical quality classification is conservative and may mark a usable archive as degraded when signals suggest the artifact might be incomplete.
- Editorial judgment about whether content is worth keeping remains entirely user-driven.
- The existing inbox remains the single surface for pending and optional review decisions.
- The attention relay may be unavailable; this must not block archive storage, inbox state, or later review.
- Headless browser rendering and per-site capture rules are out of scope for this feature.
