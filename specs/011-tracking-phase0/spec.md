# Feature Specification: Tracking Phase 0

**Feature Branch**: `011-tracking-phase0`

**Created**: 2026-05-26

**Status**: Draft

**Input**: User description: "phase 0 of docs/tracking-development-plan.md"

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Record a Track from Any Phase 0 Path (Priority: P1)

As the tracker user, I want every Phase 0 capture path to create a durable tracking record with the same core information, so I can start recording item locations without caring which device or channel I used.

**Why this priority**: Phase 0 only succeeds if the substrate can accept records consistently. Without this, voice setup, phone setup, and Signal setup cannot be validated as one tracking system.

**Independent Test**: Submit a normal track and a checkout/displaced track through each Phase 0 path and confirm each record is stored with text, capture time, source, and displaced state.

**Acceptance Scenarios**:

1. **Given** the tracking substrate is available, **When** a user records "drill is on the top shelf" through a supported Phase 0 path, **Then** a new tracking record exists with that text, a capture timestamp, the path source, and a non-displaced state.
2. **Given** the tracking substrate is available, **When** a user records "drill working on the deck" through a checkout/displaced command, **Then** a new tracking record exists with that text, a capture timestamp, the path source, and a displaced state.
3. **Given** a Phase 0 path sends optional photo or supersession information, **When** the record is accepted, **Then** the optional information is preserved without requiring the user to categorize or restructure the track.

---

### User Story 2 - Find a Recently Tracked Item (Priority: P2)

As the tracker user, I want to ask a plain text question or search phrase and see matching tracking records, so I can verify that newly captured item locations are retrievable.

**Why this priority**: Phase 0 is not a full workflow, but it must prove round-trip value: a track can be written and then found.

**Independent Test**: Record a known phrase, search for an item word from that phrase, and confirm the matching record appears with enough context to identify the item and source.

**Acceptance Scenarios**:

1. **Given** a record exists for "drill is on the garage top shelf, blue case", **When** the user searches for "drill", **Then** the matching track is returned with its text, timestamp, source, and displaced state.
2. **Given** multiple records match a query, **When** the user searches, **Then** results are ordered so the newest useful match is easiest to identify while older matches remain available as history.
3. **Given** no exact record matches a query, **When** the user searches, **Then** the system returns closest available matches or a clear "no stored tracks yet" response rather than a dead end.

---

### User Story 3 - Verify In-Home Voice Capture (Priority: P3)

As the tracker user standing in the printing room, I want to speak a track or checkout phrase to the in-room voice device and see the record appear quickly, so tracking works when my phone is not in hand.

**Why this priority**: The in-home voice path addresses the central failure mode for ADHD-aware tracking: needing to capture while already moving or handling objects.

**Independent Test**: From the printing room, speak one normal track phrase and one checkout phrase, then confirm both appear as searchable records within the target time.

**Acceptance Scenarios**:

1. **Given** the printing-room voice device is configured, **When** the user says a normal track phrase, **Then** a searchable non-displaced record appears with printing-room provenance.
2. **Given** the printing-room voice device is configured, **When** the user says a checkout phrase, **Then** a searchable displaced record appears with printing-room provenance.
3. **Given** a phrase collides with another assistant or built-in intent during testing, **When** the fallback phrase is used, **Then** the fallback still creates the intended tracking record.

---

### User Story 4 - Verify Portable and Fallback Capture (Priority: P4)

As the tracker user away from the printing room, I want phone voice and Signal commands to create the same kind of tracking records, so the system still works outside the primary voice-device coverage area.

**Why this priority**: Portable and fallback paths keep Phase 0 usable beyond one room, but they are secondary to proving the common storage and search substrate.

**Independent Test**: Create one normal and one displaced track from phone voice and Signal text, then confirm all records are searchable and distinguishable by source.

**Acceptance Scenarios**:

1. **Given** the phone voice path is configured, **When** the user speaks a normal track command with item-location content, **Then** a searchable non-displaced record appears with phone-voice provenance.
2. **Given** the phone voice path is configured, **When** the user speaks a checkout command with item-location content, **Then** a searchable displaced record appears with phone-voice provenance.
3. **Given** the Signal fallback path is configured, **When** the user sends a normal or checkout tracking command, **Then** a searchable record appears with Signal provenance and the correct displaced state.

### Edge Cases

- Empty or whitespace-only tracking text is rejected with a clear failure and no record is created.
- Missing or invalid source information is rejected so records remain attributable to a capture path.
- Missing capture time is handled consistently by assigning a reliable receive time or rejecting the request with a clear failure.
- Invalid displaced values are rejected rather than guessed.
- A supersession reference that does not identify an existing record is rejected or ignored consistently without corrupting the new record.
- Duplicate item text is allowed because Phase 0 is append-only and does not attempt automatic merge or correction.
- Stale or wrong records remain visible as last-seen information; Phase 0 does not ask the user to audit, reconcile, or clean up old records.
- Friction notes such as "friction: voice capture missed twice" are accepted as ordinary free-form tracking text without a separate feedback workflow.
- Voice phrase collisions are handled by documented fallback phrases during setup validation.
- Assistant arbitration is considered failed if the TV or another device intercepts the intended phone command during Phase 0 verification.
- Photo-based Signal tracking stores the photo reference only when a usable image is actually available; the caption remains the searchable text.

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: System MUST allow authorized tracking clients to create append-only tracking records containing free-form text, capture time, source, displaced state, optional photo reference, and optional supersession reference.
- **FR-002**: System MUST support both normal track intent and checkout/displaced intent, with the displaced state determined by the command path rather than by parsing the free-form text.
- **FR-003**: System MUST reject tracking submissions that do not include usable free-form text.
- **FR-004**: System MUST preserve the submitted text exactly enough that the user can later recognize what they said or typed.
- **FR-005**: System MUST record when each track was captured and received so records have reliable ordering without requiring the user to provide or remember timestamps.
- **FR-006**: System MUST provide a searchable retrieval path that accepts a user-entered query and returns matching tracking records.
- **FR-007**: Search results MUST include each result's text, captured or received time, source, displaced state, and identifier.
- **FR-008**: Search results MUST make the newest relevant match easier to identify than older matching history while preserving the older records as last-seen context.
- **FR-009**: System MUST provide a way to mark that a user opened a search result, so later phases can build loop-closure behavior from real retrieval activity.
- **FR-010**: System MUST allow Phase 0 in-home voice capture from one printing-room device for both normal track and checkout/displaced phrases.
- **FR-011**: System MUST allow Phase 0 portable phone voice capture for both normal track and checkout/displaced phrases.
- **FR-012**: System MUST allow Phase 0 Signal text tracking commands for both normal track and checkout/displaced phrases.
- **FR-013**: System SHOULD allow Signal photo tracking where the caption is searchable and the image reference is preserved.
- **FR-014**: System MUST keep existing non-tracking capture behavior separate from tracking commands so current capture flows continue to work.
- **FR-015**: System MUST require the same authorization posture as comparable existing agent and surface interactions before accepting writes or returning user tracking data.
- **FR-016**: System MUST avoid requiring item categories, tags, zones, or structured item/location fields during Phase 0 capture.
- **FR-017**: System MUST not edit or delete existing tracking records as part of Phase 0; corrected or moved items are represented by new records.
- **FR-018**: System MUST make Phase 0 verification possible by confirming that each configured capture path can create a searchable record.
- **FR-019**: System MUST NOT require a complete inventory, audit, backlog review, or reconciliation step before tracking and retrieval become useful.
- **FR-020**: System MUST treat friction observations as valid tracking records when entered as free-form text, without a separate log or required workflow.

### Key Entities *(include if feature involves data)*

- **Tracking Record**: A single append-only observation of an item, location, state, or tracking-related note. Key attributes are free-form text, capture time, receive time, source, displaced state, optional photo reference, and optional reference to a prior record it supersedes. It is last-seen model data, not an authoritative inventory ledger.
- **Tracking Query**: A user search attempt against tracking records. Key attributes are query text, query time, opened result, and fields reserved for future loop-closure outcome tracking. Phase 0 records query/open activity only; it does not surface prompts.
- **Capture Path**: A configured entry point that can create tracking records. Phase 0 paths are in-home voice, phone voice, Signal text, and optionally Signal photo.
- **Displaced State**: A boolean meaning the newest known record indicates the item is away from its expected place or otherwise checked out.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: 100% of configured Phase 0 capture paths can create at least one normal track and one checkout/displaced track during verification.
- **SC-002**: A record created during verification is searchable by a word from its text within 5 seconds for the printing-room voice path and within 10 seconds for portable or Signal paths under normal connectivity.
- **SC-003**: Search results for a newly created verification record show the record text, source, time, and displaced state without requiring the user to inspect logs or raw storage.
- **SC-004**: The user can complete the full smoke test of creating a track, searching for it, and opening a result without consulting implementation code.
- **SC-005**: Existing non-tracking capture commands continue to route as before throughout Phase 0 validation.
- **SC-006**: TV or other household assistant interception does not occur during the accepted phone voice verification flow.
- **SC-007**: No Phase 0 capture flow requires the user to choose a category, tag, zone, or separate item/location field before saving a record.
- **SC-008**: The first successful tracking record is immediately useful for retrieval; no inventory-completion or cleanup milestone is required before validation can pass.

## Assumptions

- The feature is for a single primary user and does not introduce household multi-user sharing.
- Phase 0 is a substrate milestone only; loop-closure prompts, duplicate prompts, board view, polished surface views, semantic retrieval, and local speech-to-text migration are out of scope.
- Existing Lattice authentication and authorization posture remains available and is reused rather than redesigned.
- The in-home voice device scope is one device assigned to the printing room.
- Other rooms are expected coverage gaps in Phase 0.
- Phone voice capture depends on the phone receiving the intended assistant command rather than the TV or another home device intercepting it.
- Signal voice transcription is not required for Phase 0 acceptance; Signal text is required and Signal photo is supported where existing message handling provides an image and caption.
- Daily backups already cover the main tracking data store; photo backup coverage can be handled later if photo tracking becomes actively used.
- Capture timestamps are supplied by the capture system or receiving service, not manually chosen by the user during tracking.

## Accessibility & Language Governance

- User-facing artifacts affected in Phase 0 are limited to search/open result interactions and device/channel feedback used during setup validation.
- WCAG 2.2 AA applies to any user-facing search or result-opening surface introduced for Phase 0 verification, including keyboard access, visible focus, meaningful labels, readable status text, and non-color-only state indicators.
- Bilingual delivery is N/A because existing Lattice product copy and this Phase 0 setup workflow are English-only and no translation resource is part of this milestone.
- `docs/accessibility/` evidence updates are N/A unless Phase 0 adds or materially changes a persistent user-facing web surface; API substrate and external device setup alone do not create durable accessibility evidence requirements.
