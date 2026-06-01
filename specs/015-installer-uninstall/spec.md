# Feature Specification: Installer Uninstall Option

**Feature Branch**: `015-installer-uninstall`

**Created**: 2026-06-01

**Status**: Draft

**Input**: User description: "add an uninstall option to the installer scripts"

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Remove an Existing Installation (Priority: P1)

As a user who previously installed Lattice with the provided installer, I need a clear uninstall option so that I can remove installed binaries, startup entries, and service registrations without manually locating every installed artifact.

**Why this priority**: This is the core user value. Without a working uninstall flow, users cannot reliably reverse an installation.

**Independent Test**: Can be tested by installing Lattice through the existing installer path, running the uninstall option, and verifying the application no longer starts automatically and installed executable artifacts are removed.

**Acceptance Scenarios**:

1. **Given** Lattice was installed with the default installer choices, **When** the user runs the uninstall option, **Then** installed binaries, startup registrations, and managed service entries created by the installer are removed or disabled.
2. **Given** optional capture or tray components were installed, **When** the user runs the uninstall option, **Then** those optional components and their startup registrations are removed along with the core agent.
3. **Given** Lattice is currently running from an installer-managed service or startup task, **When** uninstall runs, **Then** the managed process is stopped or disabled before its installed executable is removed.

---

### User Story 2 - Preserve User Configuration by Default (Priority: P2)

As a user uninstalling Lattice, I need my local configuration and user-created data to be preserved by default so that uninstalling the software does not unexpectedly delete credentials, watch settings, or other personal configuration.

**Why this priority**: Safe data handling prevents accidental loss and makes reinstalling possible without recreating configuration.

**Independent Test**: Can be tested by creating an installer-managed installation with an existing configuration file, running uninstall, and verifying configuration remains unless the user explicitly chooses removal.

**Acceptance Scenarios**:

1. **Given** a configuration file exists, **When** the user runs the default uninstall option, **Then** the configuration file remains in place and the output tells the user it was preserved.
2. **Given** the user explicitly requests complete removal, **When** uninstall runs, **Then** installer-created configuration locations are removed after a clear confirmation or explicit non-interactive choice.
3. **Given** uninstall preserves configuration, **When** the user reinstalls later, **Then** the installer can reuse the preserved configuration path rather than requiring new setup.

---

### User Story 3 - Report Clear Uninstall Results (Priority: P3)

As a user or support engineer, I need plain-text uninstall output that explains what was removed, what was preserved, and what could not be removed so that I can understand the system state after uninstall.

**Why this priority**: Clear terminal output makes the feature diagnosable and accessible without depending on color, icons, or screenshots.

**Independent Test**: Can be tested by running uninstall against complete, partial, and already-removed installations and checking that output is understandable, copyable, and accurate.

**Acceptance Scenarios**:

1. **Given** uninstall completes successfully, **When** results are displayed, **Then** the output lists the major removed components and preserved user configuration locations.
2. **Given** some installed artifacts are already missing, **When** uninstall runs, **Then** it treats missing artifacts as already removed and continues where safe.
3. **Given** a component cannot be removed because of permissions or an active process, **When** uninstall reports the failure, **Then** the message identifies the affected component and provides a next action in plain text.

---

### Edge Cases

- Uninstall is run before Lattice was ever installed.
- Only some components are present because a previous installation, update, or manual deletion was interrupted.
- Optional tray or capture components were skipped during install and should not be treated as uninstall failures.
- A managed service or startup task exists but the corresponding executable is missing.
- The user lacks permission to remove a startup registration, service entry, or installed file.
- User configuration exists but installed binaries do not.
- Uninstall is run more than once and should remain safe and understandable.

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: The installer scripts MUST provide an explicit uninstall option that users can select or pass without editing the scripts.
- **FR-002**: The uninstall option MUST remove installed Lattice executable artifacts created by the installer for the current platform.
- **FR-003**: The uninstall option MUST stop, disable, or unregister installer-managed startup entries, service entries, scheduled tasks, or equivalent launch registrations before reporting completion.
- **FR-004**: The uninstall option MUST include optional installer-managed components, including capture and tray components, when those components are present.
- **FR-005**: The uninstall option MUST preserve user configuration and user-created data by default.
- **FR-006**: The uninstall option MUST offer an explicit complete-removal path for installer-created configuration locations when the user intentionally requests it.
- **FR-007**: The uninstall option MUST be safe to run when no installation exists, when only some artifacts exist, or when it is run repeatedly.
- **FR-008**: The uninstall option MUST report a clear final summary of removed components, preserved locations, skipped missing items, and any failures.
- **FR-009**: Failure messages MUST identify the affected component and provide a plain-text next action when user intervention may resolve the issue.
- **FR-010**: The uninstall option MUST NOT require network access to remove a previously installed local installation.
- **FR-011**: Existing install behavior MUST remain available and unchanged for users who do not choose uninstall.
- **FR-012**: User-facing uninstall prompts and status output MUST be plain text, copyable, and not dependent on color, animation, icons, or glyph-only meaning.

### Key Entities

- **Installed Component**: A Lattice artifact placed by the installer, such as the agent, capture helper, tray utility, configuration helper, or launch registration.
- **Launch Registration**: A system-managed entry created by the installer to start Lattice automatically, such as a user service, scheduled task, or equivalent startup mechanism.
- **User Configuration**: Local settings, credentials, watch paths, and other user-specific data created or reused by the installer.
- **Uninstall Result**: The user-visible summary of removed, preserved, skipped, and failed uninstall actions.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: In a default installed environment, uninstall removes all installer-managed executables and launch registrations in one user action.
- **SC-002**: In an installation with optional capture and tray components, uninstall removes all present optional components without requiring separate manual cleanup.
- **SC-003**: In at least three partial-installation states, uninstall completes safely or reports only the specific blocked items without treating already-missing artifacts as fatal errors.
- **SC-004**: By default, uninstall preserves existing user configuration in 100% of successful uninstall runs.
- **SC-005**: 100% of uninstall failure messages identify the affected component and include a plain-text next action.
- **SC-006**: Existing install-only usage continues to complete with the same required user inputs as before this feature.

## Assumptions

- The feature applies to the repository's existing installer scripts for supported desktop platforms.
- User configuration should be preserved by default because it may contain credentials, watch paths, and reinstall-relevant settings.
- Complete configuration removal is allowed only through an explicit user choice, not as the default uninstall behavior.
- Network access is unnecessary for uninstall because removal operates on local installer-managed artifacts.
- User-facing installer and uninstaller output remains English-only for this feature because the current installer scripts and documentation are English-only and no bilingual delivery requirement or translation resource exists.
- Accessibility governance: affected user-facing artifacts are command-line installer and uninstaller prompts/status messages; WCAG 2.2 AA is applied where relevant through plain-text, copyable, non-color-dependent output; `docs/accessibility/` evidence is not required because this change affects CLI installer behavior rather than web UI or persisted accessibility documentation.
