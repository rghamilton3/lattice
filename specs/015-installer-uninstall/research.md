# Research: Installer Uninstall Option

## Decision: Add an explicit uninstall switch to each existing installer script

**Rationale**: The feature is about reversing work performed by the installer scripts. A switch keeps discovery close to the existing install entry point, preserves current install behavior for default invocation, and avoids introducing a separate uninstall tool that users may not know exists.

**Alternatives considered**: A separate `uninstall.sh`/`uninstall.ps1` pair was rejected because it duplicates platform path knowledge and adds another user-facing entry point. Interactive menu-only uninstall was rejected because non-interactive validation and support workflows need a direct command.

## Decision: Preserve user configuration by default and require an explicit purge option for config removal

**Rationale**: Installer-created config may contain credentials, watch paths, and settings users need for reinstall. Preserving it by default satisfies the spec's data-safety requirement while an explicit purge path supports complete removal when the user intentionally requests it.

**Alternatives considered**: Always deleting config was rejected because it risks accidental credential/settings loss. Never deleting config was rejected because the spec requires a complete-removal path.

## Decision: Uninstall should be idempotent and treat missing artifacts as already removed

**Rationale**: Partial installs, failed updates, and manual cleanup are expected edge cases. Continuing through missing files or registrations makes uninstall safe to rerun and improves support diagnostics.

**Alternatives considered**: Failing on first missing artifact was rejected because it blocks cleanup of remaining artifacts and makes repeated uninstall noisy.

## Decision: Stop or disable launch registrations before removing executables

**Rationale**: Removing executables while services or scheduled tasks still point to them leaves broken startup state and may fail on active processes. Cleanup should unregister/disable managed launch entries first, then remove binaries.

**Alternatives considered**: Removing binaries first was rejected because it can strand launch registrations and produce less actionable failures.

## Decision: Linux cleanup targets current user install artifacts only

**Rationale**: `install.sh` installs into user-owned paths such as `~/.local/bin`, `~/.config/lattice`, and `~/.config/systemd/user`. The uninstall option should match that scope and avoid privileged or system-wide cleanup.

**Alternatives considered**: System-wide cleanup was rejected because the installer is user-scoped and should not require unnecessary elevation.

## Decision: Windows cleanup targets current user install artifacts only

**Rationale**: `install.ps1` installs binaries under `%LOCALAPPDATA%\lattice`, config under `%APPDATA%\lattice`, and registers current-user scheduled tasks. The uninstall option should match that scope and avoid administrative assumptions.

**Alternatives considered**: Machine-wide registry or service cleanup was rejected because the current installer does not create those artifacts.

## Decision: Validation should cover helper behavior without requiring destructive live installs

**Rationale**: Existing installer tests already use import-only patterns for PowerShell helper validation. Similar focused tests can validate artifact classification, idempotent removal/reporting, and command parsing while manual smoke tests cover platform integration.

**Alternatives considered**: Only manual uninstall testing was rejected because it leaves regressions easy to miss. Full live install/uninstall automation on every development machine was rejected because it is platform-specific and destructive.

## Decision: CLI accessibility requirements are part of acceptance validation

**Rationale**: The affected user-facing surface is terminal output. Plain text, copyable diagnostics, and non-color-dependent status are the relevant WCAG-aligned checks for this CLI feature.

**Alternatives considered**: Web accessibility evidence under `docs/accessibility/` was rejected as not applicable because no web UI changes are planned.

## Decision: Bilingual delivery remains out of scope

**Rationale**: Current installer prompts and documentation are English-only, and there is no translation resource or bilingual requirement for this feature. The plan still records the decision explicitly for governance.

**Alternatives considered**: Adding bilingual installer strings now was rejected because it would expand scope beyond uninstall behavior and create unmaintained translation obligations.
