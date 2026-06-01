# Data Model: Installer Uninstall Option

## Installed Component

Represents an artifact the installer may place on the user's machine.

**Fields**:

- `name`: User-facing component name, such as `lattice-agent`, `lattice-capture`, `lattice-tray`, or `lattice-config`.
- `platform`: `linux` or `windows`.
- `artifact_type`: `binary`, `launch_registration`, `service_unit`, or `configuration`.
- `path_or_identifier`: Filesystem path or platform registration name.
- `optional`: Whether the component may be absent because the user skipped it during install.
- `remove_by_default`: Whether uninstall removes it during the default uninstall path.
- `requires_purge`: Whether removal requires the explicit complete-removal path.

**Validation Rules**:

- Executable artifacts and launch registrations created by the installer are removed by default.
- Configuration artifacts are preserved by default and removed only on explicit complete-removal.
- Optional components may be absent without causing uninstall failure.
- Missing artifacts are reported as skipped/already removed, not fatal errors.

## Launch Registration

Represents a platform-managed startup entry created by the installer.

**Fields**:

- `name`: Registration name, such as `lattice-agent`, `lattice-tray`, `LatticeAgent`, or `LatticeTray`.
- `platform`: `linux` or `windows`.
- `registration_type`: `systemd_user_service` or `scheduled_task`.
- `enabled_state`: `enabled`, `disabled`, `missing`, or `unknown`.
- `stop_required`: Whether uninstall should attempt to stop it before removal.

**Validation Rules**:

- Existing launch registrations are stopped or disabled before associated binaries are removed.
- Missing registrations do not block cleanup of other components.
- Failures identify the registration and the next user action.

**State Transitions**:

- `enabled` -> `disabled` -> `removed`
- `missing` -> `skipped`
- `unknown` -> `failed` with diagnostic when the state cannot be determined or changed

## User Configuration

Represents user-specific settings and credentials created or reused by the installer.

**Fields**:

- `path`: Platform-specific configuration path.
- `contains_sensitive_data`: Expected to be true because agent tokens may be stored.
- `preserve_by_default`: Always true.
- `purge_requested`: Whether the user explicitly requested complete removal.

**Validation Rules**:

- Default uninstall preserves configuration and reports the preserved path.
- Complete removal deletes installer-created configuration locations only after explicit user choice or explicit non-interactive option.
- Missing configuration is skipped safely.

## Uninstall Result

Represents the final user-visible outcome of an uninstall run.

**Fields**:

- `removed`: Components successfully removed.
- `preserved`: Configuration or data intentionally left in place.
- `skipped`: Missing or not-installed artifacts that required no action.
- `failed`: Components that could not be removed.
- `next_actions`: Plain-text user actions for failures or preserved configuration.

**Validation Rules**:

- Every uninstall run prints a final summary.
- Failures name the affected component and include a next action.
- Output remains understandable without color, icons, or terminal-specific styling.
