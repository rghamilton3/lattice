# Tasks: Signal Relay

**Input**: Design documents from `specs/007-signal-relay/`
**Prerequisites**: `plan.md`, `spec.md`, `research.md`, `data-model.md`, `contracts/signal-relay.md`, `quickstart.md`

## Phase 1: Setup

- [x] T001 Review current Signal parser, relay runtime, compose file, and README behavior in `spine/src/signal/messages.ts`, `spine/src/signal-relay.ts`, `spine/docker-compose.relay.yml`, and `README.md`
- [x] T002 Review existing parser tests and identify pure relay helper seams in `spine/tests/unit/signal-messages.test.ts`

## Phase 2: Foundational

- [x] T003 [P] Add relay helper test scaffold for attachment path safety and request payload behavior in `spine/tests/unit/signal-relay.test.ts`
- [x] T004 [P] Add parser tests for direct data-message attachments and timestamp fallback edge cases in `spine/tests/unit/signal-messages.test.ts`
- [x] T005 Export testable relay helper functions without auto-starting sockets when imported in `spine/src/signal-relay.ts`

## Phase 3: User Story 1 - Capture Signal Notes (P1)

**Goal**: Valid Signal Note-to-Self text messages become Lattice captures while non-self or malformed frames are skipped.

**Independent Test**: Parse valid and invalid Signal frames and verify normalized capture text/source timestamp behavior without a live Signal service.

- [x] T006 [P] [US1] Extend parser coverage for accepted direct and sync Note-to-Self frames in `spine/tests/unit/signal-messages.test.ts`
- [x] T007 [US1] Preserve Note-to-Self filtering, timestamp selection, and skip reason behavior in `spine/src/signal/messages.ts`
- [x] T008 [US1] Harden capture post error messages and response parsing in `spine/src/signal-relay.ts`

## Phase 4: User Story 2 - Preserve Voice Notes And Attachments (P2)

**Goal**: Attachment-only captures get meaningful text and readable attachment files upload safely to the saved capture.

**Independent Test**: Resolve safe and unsafe attachment ids against a temporary attachment directory, upload readable files through a mocked fetch, and verify missing files fail per attachment only.

- [x] T009 [P] [US2] Add attachment placeholder and direct attachment parsing tests in `spine/tests/unit/signal-messages.test.ts`
- [x] T010 [P] [US2] Add attachment path safety, missing-id, and payload formation tests in `spine/tests/unit/signal-relay.test.ts`
- [x] T011 [US2] Implement canonical attachment path confinement and readable metadata defaults in `spine/src/signal-relay.ts`
- [x] T012 [US2] Ensure attachment failures remain isolated after capture creation in `spine/src/signal-relay.ts`

## Phase 5: User Story 3 - Operate Relay Safely (P3)

**Goal**: Operators can run the relay unattended with clear config diagnostics, bounded reconnect behavior, and accurate deployment docs.

**Independent Test**: Review startup config behavior, helper tests for reconnect scheduling seams where practical, and docs for all required environment/mount details.

- [x] T013 [P] [US3] Add tests or code-review notes for reconnect helper invariants in `spine/tests/unit/signal-relay.test.ts`
- [x] T014 [US3] Keep startup config validation fail-fast and reconnect scheduling single-path behavior in `spine/src/signal-relay.ts`
- [x] T015 [US3] Improve relay Docker Compose comments and environment defaults in `spine/docker-compose.relay.yml`
- [x] T016 [US3] Update Signal relay setup and troubleshooting documentation in `README.md`

## Phase 6: Polish & Cross-Cutting Concerns

- [x] T017 [P] Document WCAG 2.2 AA evidence and bilingual N/A rationale in `docs/accessibility/signal-relay.md`
- [x] T018 Run `cd spine && bun test tests/unit/signal-messages.test.ts tests/unit/signal-relay.test.ts`
- [X] T019 Mark completed tasks in `specs/007-signal-relay/tasks.md` after verification and queue metadata updates

## Dependencies

- Phase 1 must complete before Phase 2.
- Phase 2 must complete before user-story implementation.
- US1 is the MVP and should complete before US2.
- US2 should complete before US3 documentation because attachment behavior affects operator setup.
- Polish tasks run after all selected user stories are implemented.

## Parallel Examples

- Foundational: T003 and T004 can proceed in parallel.
- US1: T006 can be written while T008 is reviewed.
- US2: T009 and T010 can proceed in parallel because they target parser and relay helper tests separately.
- US3: T013 and T016 can proceed in parallel with compose review.
- Polish: T017 can be drafted while T018 runs.

## Implementation Strategy

1. Add test seams and focused unit tests without starting the relay socket on import.
2. Preserve existing text capture behavior while improving error diagnostics.
3. Add attachment path safety and payload formation hardening.
4. Update deployment docs and accessibility evidence.
5. Run targeted spine tests and finish task bookkeeping.
