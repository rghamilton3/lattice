# Feature Specification: Desktop Companions

**Feature Branch**: `feature/time-machine-desktop-companions`

**Created**: 2026-05-26

**Status**: Draft

**Input**: User description: "Feature: Desktop Companions. Description: Provides local tray status, quick capture, configuration editing, and platform integration for desktop Lattice agents. Relevant files: agent/src/bin/lattice-capture.rs, agent/src/bin/lattice-tray.rs, agent/src/bin/lattice-tray-windows.rs, agent/src/bin/lattice-config.rs, agent/src/config_edit.rs, agent/src/ipc.rs, agent/src/ipc_client.rs, agent/src/status.rs, agent/src/platform.rs, agent/src/icon.rs, agent/lattice-tray.service, install.sh, install.ps1. Focus on this feature only; do not modify other features."

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Capture From The Desktop (Priority: P1)

A user can send a quick thought to Lattice from a hotkey, terminal command, pipe, or lightweight prompt without opening the full web surface. If the spine is unreachable, the capture is kept locally and retried later instead of being lost.

**Why this priority**: Fast capture is the highest-value desktop workflow because it preserves thoughts at the moment of interruption and must be dependable under intermittent connectivity.

**Independent Test**: Submit text through each supported input path, simulate a spine outage, and verify the user receives clear feedback while queued captures are preserved and later delivered.

**Acceptance Scenarios**:

1. **Given** a configured desktop agent and reachable spine, **When** the user sends text through the quick capture companion, **Then** the capture is posted and the user receives confirmation.
2. **Given** the spine is temporarily unreachable, **When** the user sends a quick capture, **Then** the capture is queued locally and the user receives a clear queued notification.
3. **Given** queued captures exist and the spine becomes reachable, **When** the capture companion runs again, **Then** pending captures are retried and successfully sent before the new capture completes.

---

### User Story 2 - See And Control Agent Status (Priority: P2)

A desktop user can tell whether the local indexer is running, see the last reported indexing status, start or stop the agent, and launch companion actions from the system tray or platform equivalent.

**Why this priority**: Status and control reduce uncertainty and support self-service recovery when indexing appears stale or disconnected.

**Independent Test**: Run the agent with status IPC enabled, open the tray companion, and verify status labels, error states, service actions, and companion launch actions reflect the actual agent state.

**Acceptance Scenarios**:

1. **Given** the agent is running, **When** the user opens the tray menu, **Then** current scan, spine, and error status are shown with understandable labels.
2. **Given** the agent is stopped or IPC is unavailable, **When** the user opens the tray menu, **Then** the stopped/error state is visible and start or restart actions are available where supported.
3. **Given** the user selects capture or configuration from the tray, **When** the companion launches successfully, **Then** the relevant capture or configuration workflow opens without requiring terminal commands.

---

### User Story 3 - Edit Configuration Safely (Priority: P3)

A user can edit spine connection details and watched directories through a local configuration companion that preserves readable config files, validates critical fields, and can request a reindex or restart when changes require it.

**Why this priority**: Configuration editing is less frequent than capture/status, but safe edits prevent broken installs and make watch-directory changes approachable.

**Independent Test**: Open existing and missing config files, modify connection/watch settings, save, and verify the resulting configuration is valid, comments are preserved when possible, and restart/reindex prompts behave predictably.

**Acceptance Scenarios**:

1. **Given** an existing config file with comments, **When** the user edits settings and saves, **Then** the config remains valid and unrelated formatting/comments are preserved.
2. **Given** required fields are blank or malformed, **When** the user attempts to save, **Then** the companion presents a clear error and does not silently produce an unusable configuration.
3. **Given** watched directories change, **When** the user saves and requests reindexing, **Then** the running agent receives a reindex request or the user receives a clear failure message.

---

### Edge Cases

- Empty capture input should exit quietly without creating a blank capture.
- Spine authentication, validation, or network failures should distinguish permanent rejection from retryable outage where practical.
- Local queue database creation, corruption, or write failure should not hide capture text from the user.
- IPC socket or named-pipe creation failures should leave the agent running while reporting that companion controls are unavailable.
- Stale IPC files, missing runtime directories, stopped services, or unavailable systemd/Task Scheduler commands should produce plain text diagnostics.
- Tray/status environments without a supported tray protocol should fail visibly and not affect the core agent.
- Configuration files with missing sections, blank watch patterns, duplicate watch rows, invalid TOML, or paths containing quotes/backslashes should be handled safely.
- Installers should handle missing optional companion assets, unsupported architectures, missing runtime dependencies, existing config files, and service-manager failures without corrupting user data.

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: The quick capture companion MUST accept text from command arguments, standard input, and an interactive prompt.
- **FR-002**: The quick capture companion MUST post captures to the spine using existing configured connection details and bearer-token authentication.
- **FR-003**: The quick capture companion MUST persist retryable unsent captures locally and retry them on a later run.
- **FR-004**: The quick capture companion MUST provide clear user feedback for successful, queued, rejected, and unrecoverably failed captures.
- **FR-005**: The agent MUST expose local status and reindex commands through a local IPC channel suitable for desktop companions.
- **FR-006**: The tray companion MUST display running/stopped, scan, spine reachability, and last-error status with text labels.
- **FR-007**: The tray companion MUST provide actions to start, stop, or restart the agent where the platform supports service control.
- **FR-008**: The tray companion MUST launch quick capture and configuration companions from user-visible menu actions.
- **FR-009**: The configuration companion MUST load, display, edit, and save spine connection and watch-directory settings.
- **FR-010**: The configuration companion MUST preserve existing readable configuration structure and comments where possible.
- **FR-011**: The configuration companion MUST validate required values before saving and present plain text errors for invalid or unreadable configuration.
- **FR-012**: The configuration companion MUST let users request a reindex or restart when changes require the running agent to refresh state.
- **FR-013**: Linux and Windows installation paths MUST install available companion binaries, service/task integration, and setup hints without overwriting existing user configuration unexpectedly.
- **FR-014**: Automated coverage MUST exercise capture queue behavior, configuration edit round trips, IPC status/reindex protocol, status formatting, and installer/service contracts where feasible.

### Accessibility & Localization Requirements

- **A11Y-001**: Tray labels, prompt text, configuration form labels, notifications, and diagnostics MUST be understandable without relying on color or icon-only state.
- **A11Y-002**: User-facing documentation and service diagnostics MUST include plain text commands for inspecting, restarting, and troubleshooting companion processes.
- **LANG-001**: Bilingual delivery is not required for this feature because it adds English-only local desktop companion copy and no translated web UI; this N/A decision MUST be recorded in accessibility evidence.

### Key Entities

- **Quick Capture**: User-entered text plus source and capture time that should appear in Lattice.
- **Queued Capture**: A quick capture stored locally because the spine was unavailable or temporarily rejected delivery.
- **Desktop Agent Status**: Local view of scan state, spine reachability, counts, last scan time, and last error.
- **Agent Configuration**: Spine URL/token, machine identity, polling defaults, and watch-directory rows edited by the local configuration companion.
- **Companion Service**: Platform startup/control definition for running tray and agent helpers in the user session.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: In automated or scripted tests, a quick capture submitted while online is delivered exactly once and returns user-visible confirmation.
- **SC-002**: In automated or scripted tests, a quick capture submitted while offline is stored locally and delivered on the next successful run without losing text.
- **SC-003**: Users can identify whether the agent is running and see the latest scan status from the desktop companion within 5 seconds of opening it.
- **SC-004**: Editing and saving configuration preserves required fields and produces a valid configuration file in all tested round-trip cases.
- **SC-005**: Start, stop, restart, reindex, and launch failures produce actionable text diagnostics in the companion UI, notification, terminal output, or service log.

## Assumptions

- Desktop companion functionality targets user-controlled local machines where the agent is already configured to talk to the spine.
- Linux tray behavior may depend on desktop support for StatusNotifierItem, while Windows behavior may use platform-native startup and tray mechanisms.
- Existing bearer-token authentication and spine capture routes are reused; this feature does not add new spine endpoints.
- Local notifications are helpful but not the only diagnostic channel; terminal and service logs remain acceptable fallbacks.
- English-only local companion copy is acceptable for this phase, with bilingual evidence documented as N/A.
