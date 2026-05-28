# Tasks: Surface PWA

**Input**: Design documents from `/specs/013-surface-pwa/`

**Prerequisites**: plan.md, spec.md, research.md, data-model.md, quickstart.md, contracts/pwa-runtime-contract.md, contracts/pwa-verification-contract.md

**Tests**: Verification is explicitly required by FR-013, SC-001 through SC-007, and `contracts/pwa-verification-contract.md`, so test and evidence tasks are included.

**Organization**: Tasks are grouped by user story so installability, shell resilience, and update handling can be implemented and verified as independent increments.

## Format: `[ID] [P?] [Story] Description`

- **[P]**: Can run in parallel because it touches different files and does not depend on incomplete tasks
- **[Story]**: User story label from `specs/013-surface-pwa/spec.md`
- Every task includes exact file paths for implementation or verification

## Path Conventions

- Surface app paths are under `surface/`
- Feature docs are under `specs/013-surface-pwa/`
- Accessibility evidence is under `docs/accessibility/`

## Phase 1: Setup (Shared Infrastructure)

**Purpose**: Prepare the existing SvelteKit static Surface app for PWA work without adding runtime dependencies.

- [X] T001 Inspect current SvelteKit static adapter and service worker support assumptions in `surface/svelte.config.js`
- [X] T002 Inspect current Surface document metadata and favicon setup in `surface/src/routes/+layout.svelte`
- [X] T003 [P] Inspect current app shell navigation, capture, search, and status areas for PWA notice insertion points in `surface/src/components/shell/AppShell.svelte`
- [X] T004 [P] Inspect existing Playwright smoke structure before adding PWA scenarios in `surface/e2e/surface.e2e.ts`
- [X] T005 [P] Create the accessibility evidence document scaffold with WCAG 2.2 AA and bilingual N/A sections in `docs/accessibility/surface-pwa.md`

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: Add shared PWA primitives that all user stories depend on.

**CRITICAL**: No user story work can begin until this phase is complete.

- [X] T006 Create browser-safe PWA runtime type definitions for install, display, network, service, and update states in `surface/src/lib/pwa/types.ts`
- [X] T007 [P] Create persisted install-dismissal helpers that tolerate unavailable or corrupted storage in `surface/src/lib/pwa/installPreference.ts`
- [X] T008 [P] Create browser environment helpers for standalone display detection, online/offline state, and active text-entry detection in `surface/src/lib/pwa/browserState.ts`
- [X] T009 Create a Svelte 5 PWA runtime state module for install, degraded, and update state transitions in `surface/src/lib/state/pwa.svelte.ts`
- [X] T010 Create unit tests for PWA install preference and browser-state helpers in `surface/src/lib/pwa/pwaState.test.ts`
- [X] T011 Create a reusable accessible notice component for install, degraded, and update messaging in `surface/src/components/shell/PwaNotice.svelte`
- [X] T012 Integrate the PWA runtime state provider into the root layout without changing auth or API boundaries in `surface/src/routes/+layout.svelte`

**Checkpoint**: Shared PWA state, notices, and browser helpers are ready for story-specific implementation.

---

## Phase 3: User Story 1 - Install And Relaunch Surface (Priority: P1) MVP

**Goal**: Surface is browser-recognizable as installable, can be installed, and relaunches into the usable workbench shell while preserving normal browser and deep-link use.

**Independent Test**: Open Surface in a supported browser, confirm installability, install it, close normal tabs, launch from the OS app entry, verify the workbench shell appears, verify narrow viewport navigation/capture/search reachability, and confirm a valid deep link works in browser and installed contexts.

### Tests for User Story 1

- [X] T013 [P] [US1] Add Playwright smoke coverage for manifest discovery, app-shell rendering, and deep-link preservation in `surface/e2e/pwa-install.e2e.ts`
- [X] T014 [P] [US1] Add unit coverage for install availability and dismissed-prompt transitions in `surface/src/lib/pwa/pwaInstall.test.ts`
- [X] T015 [P] [US1] Add manual install, launch, deep-link, unsupported-browser, and narrow-viewport evidence checklist entries in `docs/accessibility/surface-pwa.md`

### Implementation for User Story 1

- [X] T016 [P] [US1] Create PWA manifest metadata with name, short_name, description, start_url, scope, display, theme_color, background_color, and icons in `surface/static/manifest.webmanifest`
- [X] T017 [P] [US1] Create installable app identity icons with accessible light/dark launch contrast in `surface/static/pwa-icon.svg`
- [X] T018 [US1] Add manifest and theme discovery metadata while preserving the existing favicon in `surface/src/routes/+layout.svelte`
- [X] T019 [US1] Implement install availability capture, dismiss behavior, standalone detection, and browser fallback state in `surface/src/lib/state/pwa.svelte.ts`
- [X] T020 [US1] Add an accessible install/unsupported/dismissible Surface PWA notice in `surface/src/components/shell/AppShell.svelte`
- [X] T021 [US1] Ensure primary navigation, capture, search, and install notice remain reachable without horizontal page-level scrolling on narrow viewports in `surface/src/routes/layout.css`
- [X] T022 [US1] Verify the built static output includes manifest and icon assets by documenting the `bun run build` check in `specs/013-surface-pwa/quickstart.md`

**Checkpoint**: User Story 1 is independently functional and testable as the MVP.

---

## Phase 4: User Story 2 - Use A Resilient App Shell (Priority: P2)

**Goal**: After a successful load, Surface can relaunch during network or backend interruptions with a readable shell, clear degraded messaging, and a recovery path without exposing protected content from cache.

**Independent Test**: Load Surface once, simulate unavailable live services or network interruption, relaunch or reload the installed app, verify the shell renders instead of a blank page, verify text-based degraded messaging and retry/reload action, restore services, and verify recovery without reinstalling or clearing storage.

### Tests for User Story 2

- [X] T023 [P] [US2] Add Playwright smoke coverage for offline/degraded shell rendering and recovery actions in `surface/e2e/pwa-offline.e2e.ts`
- [X] T024 [P] [US2] Add unit coverage for degraded notice classification and recovery action transitions in `surface/src/lib/pwa/pwaDegraded.test.ts`
- [X] T025 [P] [US2] Add manual degraded/offline, expired-auth, protected-content-cache, keyboard, zoom, and reduced-motion evidence entries in `docs/accessibility/surface-pwa.md`

### Implementation for User Story 2

- [X] T026 [US2] Implement app-shell-only SvelteKit service worker caching with versioned cache names and obsolete-cache cleanup in `surface/src/service-worker.ts`
- [X] T027 [US2] Exclude `/api/*`, protected knowledge content, and non-GET requests from service worker caching in `surface/src/service-worker.ts`
- [X] T028 [US2] Prefer live network navigations and fall back to cached app shell only when current shell resources are unavailable in `surface/src/service-worker.ts`
- [X] T029 [US2] Implement online, offline, service-unavailable, authorization-required, missing-resource, and generic degraded states in `surface/src/lib/state/pwa.svelte.ts`
- [X] T030 [US2] Render accessible degraded/offline notices with retry, reload, return-home, or reauthenticate actions in `surface/src/components/shell/AppShell.svelte`
- [X] T031 [US2] Update existing API failure status wording so unavailable areas do not imply user data was deleted in `surface/src/components/shell/AppShell.svelte`

**Checkpoint**: User Stories 1 and 2 both work independently; the shell is resilient without caching protected data.

---

## Phase 5: User Story 3 - Manage App Updates Safely (Priority: P3)

**Goal**: Installed Surface detects or recovers from app version changes with clear, user-controlled update/reload messaging that avoids interrupting text entry, modal interactions, or critical actions.

**Independent Test**: Install or load one build, serve a newer build, reopen or refresh the installed app, verify the app reaches the current version through normal user action, and verify update messaging does not steal focus during text input or modal interaction.

### Tests for User Story 3

- [X] T032 [P] [US3] Add Playwright smoke coverage for update/reload affordance visibility and non-interruption behavior in `surface/e2e/pwa-update.e2e.ts`
- [X] T033 [P] [US3] Add unit coverage for update available, update pending, current, and update failed transitions in `surface/src/lib/pwa/pwaUpdate.test.ts`
- [X] T034 [P] [US3] Add manual update, failed-update recovery, active-text-entry, modal-focus, and multi-window evidence entries in `docs/accessibility/surface-pwa.md`

### Implementation for User Story 3

- [X] T035 [US3] Detect service worker controller changes, waiting workers, and version-update conditions in `surface/src/lib/state/pwa.svelte.ts`
- [X] T036 [US3] Implement user-controlled reload/update actions and update-failed recovery instructions in `surface/src/lib/state/pwa.svelte.ts`
- [X] T037 [US3] Render an accessible update/reload notice that avoids focus theft and active text-entry interruption in `surface/src/components/shell/AppShell.svelte`
- [X] T038 [US3] Coordinate update notices with existing overlays so modal interactions are not interrupted in `surface/src/components/overlays/CommandPalette.svelte`
- [X] T039 [US3] Document normal-user update recovery without manual cache clearing or reinstallation in `specs/013-surface-pwa/quickstart.md`

**Checkpoint**: All user stories are independently functional and verified.

---

## Phase 6: Polish & Cross-Cutting Concerns

**Purpose**: Complete verification, accessibility evidence, security review, and repository-level validation.

- [X] T040 [P] Complete WCAG 2.2 AA evidence for install, launch, degraded, update, keyboard, focus, contrast, zoom, reduced-motion, and non-color-only messaging in `docs/accessibility/surface-pwa.md`
- [X] T041 [P] Record bilingual delivery N/A rationale for English-only Surface copy in `docs/accessibility/surface-pwa.md`
- [X] T042 [P] Verify no new runtime dependencies, Workbox, Vite PWA plugin, push notifications, or background sync were introduced in `surface/package.json`
- [X] T043 Review service worker scope and caching behavior against the security contract in `specs/013-surface-pwa/contracts/pwa-runtime-contract.md`
- [X] T044 Run Surface type/static validation with `bun run check` and record results in `specs/013-surface-pwa/quickstart.md`
- [X] T045 Run targeted Surface unit tests with `bun run test:unit -- --run` and record results in `specs/013-surface-pwa/quickstart.md`
- [X] T046 Run repository validation with `just check` and record results in `specs/013-surface-pwa/quickstart.md`

---

## Dependencies & Execution Order

### Phase Dependencies

- **Setup (Phase 1)**: No dependencies; can start immediately.
- **Foundational (Phase 2)**: Depends on Setup completion; blocks all user stories.
- **User Story 1 (Phase 3)**: Depends on Foundational completion and is the MVP.
- **User Story 2 (Phase 4)**: Depends on Foundational completion; may reuse US1 notices but remains independently testable after a prior successful load.
- **User Story 3 (Phase 5)**: Depends on Foundational completion; may reuse US1/US2 notices but remains independently testable with build replacement.
- **Polish (Phase 6)**: Depends on all desired user stories being complete.

### User Story Dependencies

- **User Story 1 (P1)**: Can start after Foundational; no dependency on other stories.
- **User Story 2 (P2)**: Can start after Foundational; app shell resilience does not require install UX, but install/relaunch verification benefits from US1.
- **User Story 3 (P3)**: Can start after Foundational; update messaging does not require degraded-shell implementation, but shared notice styling should remain consistent.

### Within Each User Story

- Tests and evidence scaffolding should be written before implementation where practical.
- Shared runtime state helpers must exist before wiring UI notices.
- Service worker cache behavior must be implemented before degraded relaunch verification.
- Update detection must be implemented before update notice integration.
- Story checkpoints should be validated before moving to the next priority story.

### Parallel Opportunities

- T003, T004, and T005 can run in parallel after T001 and T002 begin.
- T007 and T008 can run in parallel after T006.
- T013, T014, and T015 can run in parallel for US1.
- T016 and T017 can run in parallel for US1.
- T023, T024, and T025 can run in parallel for US2.
- T032, T033, and T034 can run in parallel for US3.
- T040, T041, and T042 can run in parallel during polish.

---

## Parallel Example: User Story 1

```bash
Task: "Add Playwright smoke coverage for manifest discovery, app-shell rendering, and deep-link preservation in surface/e2e/pwa-install.e2e.ts"
Task: "Add unit coverage for install availability and dismissed-prompt transitions in surface/src/lib/pwa/pwaInstall.test.ts"
Task: "Add manual install, launch, deep-link, unsupported-browser, and narrow-viewport evidence checklist entries in docs/accessibility/surface-pwa.md"
Task: "Create PWA manifest metadata with name, short_name, description, start_url, scope, display, theme_color, background_color, and icons in surface/static/manifest.webmanifest"
Task: "Create installable app identity icons with accessible light/dark launch contrast in surface/static/pwa-icon.svg"
```

## Parallel Example: User Story 2

```bash
Task: "Add Playwright smoke coverage for offline/degraded shell rendering and recovery actions in surface/e2e/pwa-offline.e2e.ts"
Task: "Add unit coverage for degraded notice classification and recovery action transitions in surface/src/lib/pwa/pwaDegraded.test.ts"
Task: "Add manual degraded/offline, expired-auth, protected-content-cache, keyboard, zoom, and reduced-motion evidence entries in docs/accessibility/surface-pwa.md"
```

## Parallel Example: User Story 3

```bash
Task: "Add Playwright smoke coverage for update/reload affordance visibility and non-interruption behavior in surface/e2e/pwa-update.e2e.ts"
Task: "Add unit coverage for update available, update pending, current, and update failed transitions in surface/src/lib/pwa/pwaUpdate.test.ts"
Task: "Add manual update, failed-update recovery, active-text-entry, modal-focus, and multi-window evidence entries in docs/accessibility/surface-pwa.md"
```

---

## Implementation Strategy

### MVP First (User Story 1 Only)

1. Complete Phase 1: Setup.
2. Complete Phase 2: Foundational.
3. Complete Phase 3: User Story 1.
4. Stop and validate installability, installed launch, deep links, narrow viewport, and normal browser fallback.
5. Demo or deploy the installable MVP if validation passes.

### Incremental Delivery

1. Complete Setup and Foundational tasks to establish shared runtime state and notices.
2. Add User Story 1 for installability and relaunch; validate independently.
3. Add User Story 2 for app-shell resilience; validate independently with simulated outage.
4. Add User Story 3 for update safety; validate independently with build replacement.
5. Complete Polish tasks for accessibility evidence, security review, and repository checks.

### Parallel Team Strategy

1. One developer handles shared runtime state in `surface/src/lib/state/pwa.svelte.ts` and `surface/src/lib/pwa/`.
2. One developer handles UI notices in `surface/src/components/shell/` and layout metadata.
3. One developer handles Playwright and manual evidence in `surface/e2e/` and `docs/accessibility/surface-pwa.md`.
4. Coordinate edits to `surface/src/components/shell/AppShell.svelte`, `surface/src/lib/state/pwa.svelte.ts`, and `docs/accessibility/surface-pwa.md` to avoid same-file conflicts.

---

## Notes

- App-shell cache must never intentionally include `/api/*` responses or protected knowledge content.
- Browser install APIs vary; install UI must be progressive enhancement only.
- Update prompts must be visible and user-controlled, not forced during active input or modal work.
- A11Y and bilingual N/A evidence are required before the feature is complete.
