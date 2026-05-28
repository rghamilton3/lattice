# Feature Specification: Product Updates

**Feature Branch**: `012-product-updates`

**Created**: 2026-05-27

**Status**: Draft

**Input**: User description: "I would like to add an update mechanism to all possible products but especially @agents/ and desktop capture"

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Update Local Agents Reliably (Priority: P1)

A Lattice operator can check for, understand, and apply available updates for installed local agents without losing configuration, service state, queued work, or indexed-file progress.

**Why this priority**: Local agents run continuously and are the most likely installed product to fall behind. A safe update path is required before distributing fixes or capture improvements broadly.

**Independent Test**: Install an older agent release with existing configuration and local state, publish or stage a newer release, perform the update flow, and verify the agent reports the new version while preserving configuration, service behavior, and pending local work.

**Acceptance Scenarios**:

1. **Given** a configured local agent is running an older release, **When** the operator checks for updates, **Then** the operator sees whether a newer approved release is available and what product will be updated.
2. **Given** an update is available for the local agent, **When** the operator applies it, **Then** the installed agent is replaced safely and resumes with the same configuration and expected background operation.
3. **Given** an agent update cannot be completed, **When** the failure occurs, **Then** the operator receives a clear reason and the previously working agent remains usable or recovery instructions are shown.

---

### User Story 2 - Keep Desktop Capture Current (Priority: P2)

A desktop user can keep quick capture and tray/configuration companions current alongside the local agent, so desktop capture behavior, prompts, and diagnostics stay consistent with the installed system.

**Why this priority**: Desktop capture is explicitly called out as a priority and depends on companion binaries that users interact with directly.

**Independent Test**: Install older desktop capture companions, complete an update, and verify quick capture, tray launch actions, status display, and configuration access still work after the update.

**Acceptance Scenarios**:

1. **Given** desktop capture companions are installed with the agent, **When** an update includes companion changes, **Then** the update flow identifies and updates those companions together unless the operator explicitly chooses otherwise.
2. **Given** desktop capture is in use while an update is requested, **When** the update runs, **Then** user-entered capture text is not lost and the user receives actionable status about any temporary interruption.
3. **Given** a desktop environment cannot support a companion after update, **When** the user starts the companion, **Then** the user receives a plain-language diagnostic and the core agent remains usable.

---

### User Story 3 - Discover Updates Across Products (Priority: P3)

A Lattice operator can determine which installable or deployable Lattice products are update-capable, which installed versions are current, and which products require manual update steps.

**Why this priority**: The long-term goal is coverage for all possible products, but agent and desktop capture updates provide the first valuable slice.

**Independent Test**: Review a mixed installation containing update-capable and manually updated products, run the update discovery flow, and verify each product is clearly reported with current version, latest available version, and next action.

**Acceptance Scenarios**:

1. **Given** multiple Lattice products are installed or configured, **When** the operator checks update status, **Then** each recognized product is reported as current, update available, unsupported for automatic update, or unknown.
2. **Given** a product is not yet eligible for automatic updates, **When** the operator reviews update status, **Then** the operator sees safe manual guidance instead of a misleading success state.
3. **Given** update information cannot be reached, **When** the operator checks status, **Then** installed versions remain visible and the unavailable update source is clearly identified.

---

### User Story 4 - Audit Update Outcomes (Priority: P4)

A Lattice operator can review recent update attempts, including what changed, what succeeded, what failed, and what manual recovery action is needed.

**Why this priority**: Update failures can leave user machines uncertain; a readable outcome history supports troubleshooting without requiring memory of terminal output.

**Independent Test**: Run successful, skipped, and failed update attempts, then review the update history and verify it records product names, versions, status, time, and next action.

**Acceptance Scenarios**:

1. **Given** an update completes successfully, **When** the operator reviews update history, **Then** the old and new product versions plus completion time are visible.
2. **Given** an update is skipped because the product is already current, **When** history is reviewed, **Then** the skip reason is recorded without being presented as an error.
3. **Given** an update fails, **When** history is reviewed, **Then** the failure reason and recommended next action are visible in plain language.

---

### Edge Cases

- Update checks may occur while the machine is offline, behind a captive network, or unable to reach update metadata.
- An installed product may have no version marker, a malformed version marker, or an unsupported pre-release version.
- A user may have locally modified files, missing companion binaries, partial installs, or a service manager that is unavailable.
- Downloads or staged update artifacts may be interrupted, corrupted, incomplete, or fail integrity verification.
- An update may require stopping or restarting a running background process while queued capture or indexing work exists.
- A product may be newer than the latest published stable release because it was installed from a development build.
- Multiple products may share installation directories or configuration locations and must not overwrite each other's user data.
- Roll-forward recovery may be possible even when rollback is not; the user still needs clear status and next steps.
- Update diagnostics must remain understandable in terminals, service logs, notifications, and any desktop prompts without relying on color alone.

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: The system MUST identify installed update-capable Lattice products and report each product name, installed version, update eligibility, and current update status.
- **FR-002**: The system MUST prioritize local agent update support, including preservation of existing configuration, service behavior, and locally queued or cached work.
- **FR-003**: The system MUST support updating desktop capture companions that are installed alongside the local agent, including quick capture, tray/status, and configuration companions where present.
- **FR-004**: The system MUST distinguish products that can be updated automatically from products that require manual update instructions.
- **FR-005**: The system MUST allow an operator to check for updates without applying them.
- **FR-006**: The system MUST present enough release information for an operator to decide whether to apply an update, including product affected, installed version, available version, and high-level change summary when available.
- **FR-007**: The system MUST require explicit operator action before applying an update that changes installed software.
- **FR-008**: The system MUST verify update artifacts before replacing installed product files.
- **FR-009**: The system MUST avoid overwriting user configuration, local queues, local caches, service definitions customized by the user, and user-created data unless the operator explicitly confirms a documented migration or reset.
- **FR-010**: The system MUST leave the previous working product usable or provide clear recovery instructions when an update fails before completion.
- **FR-011**: The system MUST restart, reload, or instruct the operator to restart affected background products when required for the update to take effect.
- **FR-012**: The system MUST record each update attempt with product, starting version, target version, outcome, time, and actionable error or next-step text.
- **FR-013**: The system MUST provide clear status for offline, already-current, unsupported, failed-verification, failed-installation, and successfully updated outcomes.
- **FR-014**: The system MUST support a staged rollout path where agent and desktop capture updates are available before every other product has automatic update support.
- **FR-015**: Automated or scripted coverage MUST exercise update discovery, no-op status checks, successful agent update, successful desktop capture companion update, failed artifact verification, interrupted update, and preservation of existing user state.

### Accessibility & Localization Requirements

- **A11Y-001**: User-facing update status, confirmations, failures, and recovery instructions MUST be understandable as plain text and MUST NOT rely on color, icon-only state, or transient notifications alone.
- **A11Y-002**: Any persistent desktop or web update controls introduced by this feature MUST meet WCAG 2.2 AA for keyboard access, visible focus, labels, status announcements, and non-color-only state.
- **A11Y-003**: If the feature only exposes terminal, installer, service-log, or notification output for a product, accessibility evidence MUST document readable text, non-color-only status, and recovery instruction coverage for that output.
- **LANG-001**: Bilingual delivery is not required for this feature because existing Lattice product setup and diagnostic copy is English-only and no translation resource is in scope; this N/A decision MUST be documented in accessibility evidence.

### Key Entities

- **Product**: A Lattice installable or deployable unit that can be reported in update status, such as a local agent, desktop capture companion, service helper, web surface, or server-side component.
- **Installed Version**: The version currently present for a product on the user's machine or deployment.
- **Available Update**: A newer approved product version with associated metadata, high-level changes, eligibility rules, and artifact references.
- **Update Attempt**: One check or apply operation with product identity, versions, outcome, time, and next action.
- **Update Artifact**: The file or package intended to replace an installed product after verification.
- **User State**: Configuration, queued captures, cache metadata, service preferences, logs, and user-created data that must be preserved across updates.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: In scripted verification, an older configured local agent updates to the target version within 5 minutes while preserving configuration and resuming normal background operation.
- **SC-002**: In scripted verification, installed desktop capture companions update with the agent and still complete a quick capture within 30 seconds after update.
- **SC-003**: In scripted verification, an update check reports current or available status for every recognized installed product and clearly marks unsupported products without applying changes.
- **SC-004**: In failure testing, corrupted or incomplete update artifacts are rejected 100% of the time before installed product files are replaced.
- **SC-005**: In failure testing, interrupted or failed updates preserve user configuration and queued capture text in 100% of tested cases.
- **SC-006**: At least 95% of tested update outcomes produce a plain-language status message that identifies the product, outcome, and next action without requiring debug logs.

## Assumptions

- Initial automatic update support may cover local agents and desktop capture companions first, while other products can report manual guidance until automatic update support is added.
- Products already have or can expose a stable version marker suitable for update status reporting.
- Existing installation locations and service configuration remain the source of truth for detecting installed local products.
- Update metadata and artifacts are expected to come from the project's approved release channel, with development builds reported clearly when they cannot be matched to a stable release.
- The feature should preserve the project's self-hosting and local-first posture; update checks must not require a new hosted account or transmit private user content.
- Accessibility evidence should be updated under `docs/accessibility/` if persistent desktop or web update controls are introduced; terminal-only or service-log-only coverage may be documented as applicable output evidence.
