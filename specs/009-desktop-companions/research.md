# Research: Desktop Companions

## Decision: Quick capture uses a local SQLite retry queue

**Rationale**: Captures must not be lost when the spine is unreachable. A per-user SQLite queue is already aligned with the local-first model, supports durable ordered retries, and can preserve compatibility with previous queue formats.

**Alternatives considered**: Plain files were simpler but harder to drain atomically and validate. In-memory retry would lose data on exit. Posting synchronously without a queue would violate the primary capture reliability requirement.

## Decision: Companion control uses local line-oriented IPC

**Rationale**: Tray and config tools need status and reindex controls without adding spine endpoints or widening network attack surface. A local socket or named pipe with simple `status` and `reindex` commands is sufficient and easy to diagnose.

**Alternatives considered**: HTTP localhost control would add another server and security surface. Direct process inspection cannot request reindexing or return structured status. File polling is slower and ambiguous.

## Decision: Linux tray uses StatusNotifierItem and systemd user service control

**Rationale**: Linux desktop support in the project targets user services and modern panels such as Waybar. StatusNotifierItem maps well to tray status/menu actions and systemd user services provide restart/start/stop commands.

**Alternatives considered**: Legacy XEmbed tray support is not aligned with Wayland-first desktops. A terminal-only status command is useful but not enough for the desktop companion story.

## Decision: Windows uses installed binaries plus Task Scheduler startup

**Rationale**: Task Scheduler is available by default, works for user logon startup, and avoids requiring a Windows service install. The installer can place binaries under `%LOCALAPPDATA%` and config under `%APPDATA%`.

**Alternatives considered**: Windows services require elevated setup and complicate user-scoped config. Registry Run keys are simpler but offer weaker restart behavior and less visibility.

## Decision: Configuration editing preserves TOML structure with `toml_edit`

**Rationale**: Users may hand-edit config files and comments are valuable setup context. Preserving comments and formatting reduces surprise while still allowing structured updates to known fields.

**Alternatives considered**: Rewriting config from a serde struct is simpler but destroys comments and user formatting. Free-form text editing provides no validation.

## Decision: Accessibility evidence treats companion labels and diagnostics as user-facing

**Rationale**: Tray labels, notification text, prompts, installer output, and service logs are the primary UI for this feature. They must be understandable as plain text and not depend only on color or icon state.

**Alternatives considered**: Deferring accessibility evidence because this is local tooling was rejected; the companion UI is explicitly user-facing.

## Decision: Bilingual delivery is N/A for this phase

**Rationale**: The project currently ships English-only local companion copy and no translation framework for Rust desktop UI or installers. No translated web UI is introduced.

**Alternatives considered**: Adding localization infrastructure now would be speculative and outside the feature scope.
