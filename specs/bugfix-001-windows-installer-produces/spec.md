# Feature Specification: Windows Installer Release Asset Download Fix

**Feature Branch**: `bugfix/001-windows-installer-produces`

**Created**: 2026-05-28

**Status**: Draft

**Input**: User description: "Windows installer produces an Invoke-WebRequest error while downloading lattice-agent-x86_64-pc-windows-msvc.exe for latest release tag agent-v0.10.0. The response body is GitHub's Page not found HTML instead of the expected binary asset."

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Download Required Windows Assets From Release Metadata (Priority: P1)

As a Windows installer user, I need the installer to resolve required binary downloads from the latest GitHub release metadata so that it downloads the actual published assets instead of a constructed URL that may return GitHub 404 HTML.

**Why this priority**: This is the core installer breakage and the minimum viable fix; without it the Windows installer cannot reliably install the agent.

**Independent Test**: Can be tested by feeding release metadata containing the required agent and capture asset names and verifying the installer resolves their `browser_download_url` values before downloading.

**Acceptance Scenarios**:

1. **Given** latest release metadata contains `lattice-agent-x86_64-pc-windows-msvc.exe`, **When** the installer resolves the agent asset, **Then** it uses that asset's `browser_download_url` for `Invoke-WebRequest`.
2. **Given** latest release metadata contains `lattice-capture-x86_64-pc-windows-msvc.exe`, **When** the installer resolves the capture asset, **Then** it uses that asset's `browser_download_url` for `Invoke-WebRequest`.
3. **Given** the installer is run with `-SkipTray`, **When** assets are resolved, **Then** the tray asset is not required or looked up.

---

### User Story 2 - Fail Clearly Before Download When Required Assets Are Missing (Priority: P2)

As a Windows installer user, I need a clear error when a required release asset is absent so that diagnostics identify the missing asset and release tag without writing GitHub error HTML into a binary destination.

**Why this priority**: Missing asset handling prevents misleading binary files and makes release-publishing regressions diagnosable.

**Independent Test**: Can be tested with release metadata missing `lattice-agent-x86_64-pc-windows-msvc.exe` and verifying the installer errors before any `Invoke-WebRequest` call for that asset.

**Acceptance Scenarios**:

1. **Given** latest release metadata lacks `lattice-agent-x86_64-pc-windows-msvc.exe`, **When** the installer resolves required assets, **Then** it stops before download and prints a plain-text error naming the missing asset and release tag.
2. **Given** latest release metadata lacks `lattice-capture-x86_64-pc-windows-msvc.exe`, **When** the installer resolves required assets, **Then** it stops before download and prints a plain-text error naming the missing asset and release tag.
3. **Given** the installer stops due to a missing required asset, **When** the failure is reported, **Then** it must not leave GitHub 404 HTML in the target binary path.

---

### User Story 3 - Preserve Optional Tray Behavior And Accessible CLI Output (Priority: P3)

As a Windows installer user, I need optional tray installation and terminal output behavior to remain stable so that existing installer usage continues to work and failures are readable in plain text.

**Why this priority**: This preserves existing `-SkipTray` semantics and keeps user-facing diagnostics accessible while implementing the fix.

**Independent Test**: Can be tested by running resolver checks with and without `-SkipTray`, plus parser validation for `install.ps1`.

**Acceptance Scenarios**:

1. **Given** `-SkipTray` is provided, **When** the installer runs, **Then** tray download resolution is skipped and required agent/capture downloads proceed.
2. **Given** `-SkipTray` is not provided and the tray asset exists, **When** the installer runs, **Then** the tray asset resolves through its `browser_download_url`.
3. **Given** any missing-asset error is displayed, **When** a user reads or copies it, **Then** the message is plain text, does not rely on color or glyph-only meaning, and remains English-only to match the current installer scope.

---

### Edge Cases

- Latest release metadata has an empty or missing `tag_name`.
- Latest release metadata has the expected asset name but an empty `browser_download_url`.
- Latest release metadata has similarly named assets that must not match partial or glob-like names.
- `-SkipTray` should avoid tray lookup even if the tray asset is missing from release metadata.
- GitHub returns an API object successfully, but the expected Windows asset was not published.

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: The installer MUST obtain latest release metadata from `https://api.github.com/repos/rghamilton3/lattice/releases/latest` and use API-provided asset metadata for Windows asset downloads.
- **FR-002**: The installer MUST resolve `lattice-agent-x86_64-pc-windows-msvc.exe` by exact asset name and download it using its `browser_download_url`.
- **FR-003**: The installer MUST resolve `lattice-capture-x86_64-pc-windows-msvc.exe` by exact asset name and download it using its `browser_download_url`.
- **FR-004**: The installer MUST resolve `lattice-tray-x86_64-pc-windows-msvc.exe` by exact asset name only when tray installation is not skipped.
- **FR-005**: The installer MUST fail before invoking `Invoke-WebRequest` for a required asset when that asset is absent from latest release metadata.
- **FR-006**: Missing-asset failures MUST include the missing asset name and latest release tag when available.
- **FR-007**: Missing-asset failures MUST be plain text and MUST NOT rely on color or glyph-only meaning.
- **FR-008**: The fix MUST preserve existing install directories and the `-SkipTray` parameter behavior.
- **FR-009**: Regression coverage MUST prove the resolver uses `browser_download_url`, fails before download for a missing required asset, and skips tray lookup when `-SkipTray` is set.
- **FR-010**: The installer MUST NOT write GitHub 404 HTML into binary destination paths as part of handling missing or renamed assets.

### Key Entities

- **Release Asset Metadata**: Latest GitHub release response with `tag_name` and `assets[]` entries containing exact `name` and `browser_download_url` values.
- **Installer Asset Request**: The installer's request for an asset name, destination path, and whether the asset is required for the selected install options.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: With release metadata containing all expected Windows assets, the installer resolves agent, capture, and optional tray downloads to their `browser_download_url` values.
- **SC-002**: With release metadata missing a required asset, the installer exits before attempting that asset download and prints the missing asset name.
- **SC-003**: With `-SkipTray`, resolver validation confirms the tray asset is not required or looked up.
- **SC-004**: `install.ps1` passes PowerShell parser validation when `pwsh` is available.

## Assumptions

- Existing GitHub Releases distribution remains the source of installer binaries.
- Existing release workflow asset names are the intended contract unless implementation proves a mismatch.
- Installer prompts and documentation are currently English-only; bilingual delivery is out of scope for this bugfix.
