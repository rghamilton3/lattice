# Feature Specification: Tracking Phase 1

**Feature Branch**: `012-tracking-phase1`

**Created**: 2026-05-26

**Status**: Draft

**Input**: User description: "Review docs/tracking-design-principles.md then docs/tracking-development-plan.md and spec phase 1"

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Complete a Track and Retrieval Cycle (Priority: P1)

As the tracker user, I want to record an item location through any live tracking path and later retrieve it with a plain-language search, so the system becomes useful as a reflexive location memory rather than a passive data store.

**Why this priority**: Phase 1 only succeeds if tracking and retrieval form a usable loop. A record that cannot be found in normal use does not support the core promise: tracking should be one motion and retrieval should be one question.

**Independent Test**: Record a real item using a live tracking path, search for that item later using ordinary phrasing, and confirm the newest useful record is visible with enough context to act on it.

**Acceptance Scenarios**:

1. **Given** a live tracking path is available, **When** the user records "drill is on the garage top shelf, blue case", **Then** the record is saved without requiring category, tag, zone, or separate item/location decisions.
2. **Given** the recorded drill track exists, **When** the user searches for "where is the drill", **Then** the newest matching record is shown as the primary answer with timestamp, source, and displaced state.
3. **Given** older records also mention the same item, **When** the search results are shown, **Then** older matching records remain available as history instead of being hidden or overwritten.
4. **Given** no exact match exists, **When** the user searches, **Then** the system avoids a dead end by showing the closest available matches or a clear empty-state explanation.

---

### User Story 2 - Close the Loop After Retrieval (Priority: P2)

As the tracker user, I want the system to offer a lightweight follow-up after I look up an item, so I can confirm whether the model is still useful or record the new location without turning maintenance into a chore.

**Why this priority**: Loop closure is the Phase 1 workflow feature that distinguishes the system from searchable notes. It supports ADHD-aware re-entry and accuracy without introducing guilt, backlog, or mandatory review.

**Independent Test**: Search for an item, open a result, wait until the follow-up becomes eligible, and respond using each available outcome across separate real or test items.

**Acceptance Scenarios**:

1. **Given** the user opened a search result for an item within the follow-up window, **When** enough time has passed and no newer matching track exists, **Then** the system offers one specific follow-up referencing the original query and opened record.
2. **Given** the opened record was a normal non-displaced track, **When** the follow-up appears, **Then** the affirmative option reads naturally as confirmation that the item is still there.
3. **Given** the opened record was a checkout or displaced track, **When** the follow-up appears, **Then** the affirmative option reads naturally as confirmation that the item is still out or displaced.
4. **Given** the user chooses the affirmative response, **When** the response is saved, **Then** the follow-up is closed without creating a new tracking record.
5. **Given** the user chooses to record where the item is now, **When** the new location or state is submitted, **Then** a new tracking record is created and connected to the prior opened record as an update.
6. **Given** the user chooses to skip, **When** the response is saved, **Then** the follow-up disappears and does not reappear as debt.

---

### User Story 3 - See Helpful Duplicate Hints Without Auto-Cleanup (Priority: P3)

As the tracker user, I want the system to flag likely duplicate or update-worthy tracks at save time, so I can notice possible continuity without being forced to merge, edit, or curate records.

**Why this priority**: Duplicate hints can improve retrieval quality, but Phase 1 must preserve the design principle that tracking stays low-friction and the user decides whether a detection matters.

**Independent Test**: Save a track whose wording strongly overlaps a recent prior track and confirm the response includes possible related records while the new record still saves normally.

**Acceptance Scenarios**:

1. **Given** a recent record exists for "drill on the garage top shelf", **When** the user tracks "drill in blue case on garage shelf", **Then** the system saves the new record and may show likely related prior records.
2. **Given** likely related records are shown, **When** the user takes no merge or supersession action, **Then** the new record remains valid and no existing record is changed.
3. **Given** duplicate detection is uncertain, **When** no strong overlap is found, **Then** the track still saves without interrupting the user.

---

### User Story 4 - Use the Workflow Without Surface Polish (Priority: P4)

As the tracker user, I want Phase 1 to be runnable through the simplest available retrieval and follow-up surfaces, so workflow validation can start before a polished tracking interface or board view exists.

**Why this priority**: The development plan explicitly warns against over-building Phase 1 before real use. A basic but dependable workflow is more valuable than a polished surface that delays Phase 2 learning.

**Independent Test**: Complete track, search, result-open, follow-up, and follow-up response using the chosen Phase 1 surface without consulting implementation code or manually editing stored data.

**Acceptance Scenarios**:

1. **Given** Phase 1 is deployed, **When** the user wants to retrieve a tracked item, **Then** there is at least one documented user-facing way to search and open a result.
2. **Given** a loop-closure follow-up is pending, **When** the user reaches the follow-up surface, **Then** the available actions are specific, dismissible, and do not appear as an accumulating backlog.
3. **Given** the user ignores or dismisses follow-ups, **When** tracking and retrieval continue, **Then** the system remains usable and does not require catch-up work.

### Edge Cases

- Follow-ups are not created for searches where the user did not open a result.
- Follow-ups are not created when a newer matching track already exists after the opened result.
- A follow-up expires after the defined window and does not remain as visible debt.
- Skipping a follow-up closes it once and does not schedule nagging or repeated reminders.
- Empty or whitespace-only search text is rejected with a clear user-facing failure.
- Empty or whitespace-only replacement location text is rejected when the user chooses to record a moved item.
- If the opened record no longer exists or cannot be referenced, the follow-up is not shown or is safely closed without asking the user to repair data.
- Duplicate hints must never block saving a new record.
- Duplicate hints must never modify, merge, or delete records without an explicit user action.
- Friction observations such as "friction: loop prompt showed up while busy" remain valid ordinary tracking records.
- Stale records remain useful as last-seen information and must not trigger audit, cleanup, or completeness requirements.

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: System MUST treat all Phase 0 tracking paths as live sources that can create ordinary Phase 1 tracking records.
- **FR-002**: System MUST preserve the one-motion tracking model by accepting free-form text without requiring categories, tags, zones, separate item/location fields, or inventory-completeness checks.
- **FR-003**: System MUST provide at least one user-facing retrieval path where the user can enter a plain-language item or location question and see matching tracking records.
- **FR-004**: Retrieval results MUST identify the newest useful match as the primary answer while preserving older matching records as history.
- **FR-005**: Retrieval results MUST show enough context for action: record text, relative or absolute time, source/provenance, and displaced state.
- **FR-006**: Retrieval MUST record the user's query and whether the user opened a result so loop-closure behavior can be based on actual retrieval activity.
- **FR-007**: System MUST support a loop-closure follow-up for opened retrieval results when the user searched within the recent follow-up window, opened a result, enough time has passed, no newer matching track exists, and the follow-up has not already been closed.
- **FR-008**: A loop-closure follow-up MUST quote or clearly reference the opened track text and the original item/query context.
- **FR-009**: A loop-closure follow-up MUST offer exactly three user outcomes: confirm still accurate, record where it is now, or skip.
- **FR-010**: The affirmative follow-up wording MUST adapt to displaced state so normal tracks read as still in place and displaced tracks read as still out or displaced.
- **FR-011**: Confirming still accurate MUST close the follow-up without creating a new tracking record.
- **FR-012**: Recording where it is now MUST create a new append-only tracking record and preserve continuity with the opened record where supported.
- **FR-013**: Skipping MUST close the follow-up without creating follow-up debt, counters, repeated nags, or visible backlog pressure.
- **FR-014**: Follow-ups MUST expire automatically after the follow-up window if the user does not act.
- **FR-015**: System MUST provide lightweight duplicate or possible-update hints when a new track strongly overlaps recent prior tracking text.
- **FR-016**: Duplicate hints MUST be advisory only; the new track remains saved and no existing record is automatically edited, deleted, merged, or superseded.
- **FR-017**: System MUST preserve append-only tracking discipline; corrections, moves, check-ins, and checkouts are represented as new records rather than edits to old ones.
- **FR-018**: System MUST continue to allow friction observations as ordinary free-form tracking text without a separate feedback workflow.
- **FR-019**: System MUST remain usable if the user ignores every follow-up or duplicate hint.
- **FR-020**: System MUST NOT introduce v2 prompt types, board/drag organization, semantic retrieval, photo OCR, inventory audits, or complete-inventory requirements in Phase 1.
- **FR-021**: Any persistent user-facing retrieval or follow-up surface MUST be keyboard accessible, expose visible focus, use meaningful labels, and avoid color-only state communication.

### Key Entities *(include if feature involves data)*

- **Tracking Record**: An append-only observation of an item, location, displaced state, or friction note. It contains recognizable free-form text, timing, source/provenance, displaced state, optional photo reference, and optional continuity with a prior record.
- **Tracking Query**: A user retrieval attempt. It records the query text, query time, opened result when applicable, and loop-closure status once a follow-up is answered or expires.
- **Loop-Closure Follow-Up**: A specific, dismissible offer created from an opened retrieval result. It asks whether the opened record is still accurate, lets the user record the new location/state, or lets the user skip.
- **Duplicate Hint**: An advisory signal that a new track may relate to a recent prior record. It does not change data by itself.
- **Displaced State**: A true/false property on the newest relevant tracking record indicating whether the item is known to be away from its expected place or otherwise checked out.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: The user can complete a full real-item cycle of track, query, open result, receive loop-closure follow-up, and answer the follow-up without consulting implementation documentation.
- **SC-002**: At least three loop-closure follow-ups are successfully completed on real items before Phase 1 is considered done.
- **SC-003**: 100% of completed loop-closure follow-ups end in one of the three defined outcomes: still accurate, moved/new location, or skipped.
- **SC-004**: A newly tracked item can be found by ordinary item wording within 10 seconds during normal single-user use.
- **SC-005**: Search results for matching records show the primary newest answer and older history in a way the user can distinguish without inspecting raw storage.
- **SC-006**: Duplicate hints never prevent a valid tracking record from being saved during normal use.
- **SC-007**: No Phase 1 workflow asks the user to perform an inventory audit, clear a backlog, maintain a streak, or resolve accumulated follow-up debt.
- **SC-008**: The user can ignore or skip all pending follow-ups and still continue tracking and retrieving items successfully.
- **SC-009**: Any persistent web-based retrieval or follow-up surface introduced for Phase 1 meets WCAG 2.2 AA basics for keyboard operation, visible focus, labels, and non-color-only state.

## Assumptions

- Phase 1 builds on a completed Phase 0 substrate with live tracking paths and searchable records.
- The target user is a single primary user; household multi-user behavior remains out of scope.
- The workflow may use a minimal retrieval or follow-up surface while the polished tracking surface and board view remain deferred.
- Loop-closure timing follows the development plan default: recent searches within 14 days, follow-up eligibility after enough time has passed, and expiration after the follow-up window.
- Matching for follow-up suppression and duplicate hints can be lightweight and imperfect in Phase 1; advisory behavior is preferred over blocking or automatic cleanup.
- Semantic retrieval, photo OCR, v2 prompts, board organization, and polished first-class tracking surface work are deferred to later phases.
- Existing Lattice authentication, notification posture, and positive-dismissal patterns remain available for Phase 1 use.
- Bilingual delivery is not required because existing Lattice product copy and this tracking workflow are English-only.

## Accessibility & Language Governance

- User-facing artifacts affected in Phase 1 are retrieval results, opened-result interactions, loop-closure follow-ups, duplicate hints, and any temporary workflow documentation needed to complete the cycle.
- WCAG 2.2 AA applies to any persistent web-based retrieval, result-opening, duplicate-hint, or loop-closure surface introduced in Phase 1.
- If Phase 1 uses only temporary command, Signal, or setup flows for part of the workflow, `docs/accessibility/` evidence is N/A for those non-web surfaces because they do not create durable web UI; user-facing text should still be readable, specific, and not rely on color alone.
- If Phase 1 adds or materially changes persistent web UI, `docs/accessibility/` evidence SHOULD be updated with keyboard, focus, label, and non-color-only state checks.
- Bilingual delivery is N/A because no translation resource or bilingual product requirement is part of this milestone.
