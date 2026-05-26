# Implementation Plan: Desktop Companions

**Branch**: `feature/time-machine-desktop-companions` | **Date**: 2026-05-26 | **Spec**: [spec.md](./spec.md)

**Input**: Feature specification from `/specs/009-desktop-companions/spec.md`

## Summary

Deliver and verify the Rust desktop companion binaries and platform integration around the local agent: quick capture with offline queue, tray status/control, local configuration editing, IPC status/reindex commands, Linux/Windows installer wiring, and accessible diagnostics. Keep the spine boundary unchanged by reusing existing bearer-token capture/index contracts and keep all companion state local to the user machine.

## Technical Context

**Language/Version**: Rust 2024 edition for desktop companions; Bash for Linux installer; PowerShell for Windows installer

**Primary Dependencies**: Existing Rust crates `reqwest`, `rusqlite`, `serde_json`, `tokio`, `tracing`, `notify-rust`, optional `eframe` GUI feature, Unix `ksni`, Windows `tray-icon`; system tools `systemctl --user` and Task Scheduler

**Storage**: Local SQLite queue at the platform data directory; config TOML at platform config directory; no new spine tables or hosted storage

**Testing**: `cargo test`; targeted unit tests for config editing, formatting, icon/status helpers, queue behavior where feasible; installer review/command checks for shell and PowerShell scripts

**Target Platform**: User-controlled Linux desktop/laptop with systemd user services and StatusNotifierItem tray support; Windows desktop with Task Scheduler and native tray/hotkey setup guidance

**Project Type**: Local desktop CLI/GUI companions plus platform installer scripts

**Performance Goals**: Quick capture exits within a few seconds for normal POSTs; tray status IPC uses short local timeouts; offline queue drains without blocking capture indefinitely; config editor saves atomically

**Constraints**: No new spine endpoints; no cloud dependency; no local vector index; do not expose bearer tokens in logs; diagnostics must be plain text and not color/icon-only; service/task failures must not corrupt config or queued captures

**Scale/Scope**: Single-user desktop installs on personal machines. Out of scope: multi-user desktop deployment, mobile companions, global shortcut registration beyond documented OS mechanisms, and redesigning the web surface.

## Constitution Check

_GATE: Must pass before Phase 0 research. Re-check after Phase 1 design._

| Principle                      | Gate Question                                                                    | Pass / Violation                                                                 |
| ------------------------------ | -------------------------------------------------------------------------------- | -------------------------------------------------------------------------------- |
| I. Self-Hosting First          | Does this feature add a mandatory external service?                              | Pass - companions run locally and use the existing self-hosted spine              |
| II. Component Boundaries       | Does this feature introduce cross-component coupling beyond REST API contracts?   | Pass - capture uses existing `/api/agent/capture`; control/status are local IPC   |
| III. Local-First Data          | Does this feature store user data outside user-controlled SQLite/local files?     | Pass - queue/config/service state stay in per-user local files                    |
| IV. Security by Design         | Does this feature add a new route group without a declared auth model?            | Pass - no new route group; existing bearer token routes are reused                |
| V. Simplicity over Abstraction | Does this feature introduce an abstraction with fewer than 3 concrete callsites?  | Pass - existing direct modules map to concrete binaries/platform helpers          |
| V. Simplicity over Abstraction | Does this feature add ORM/flags/compat shims without persisted-data need?         | Pass - no ORM; queue schema compatibility is a persisted-data need                |
| Tech Stack                     | Does this feature add a runtime dependency outside the approved technology stack? | Pass - uses existing approved Rust agent dependencies and installer scripts       |

## Project Structure

### Documentation (this feature)

```text
specs/009-desktop-companions/
├── plan.md
├── research.md
├── data-model.md
├── quickstart.md
├── contracts/
│   └── desktop-companions.md
└── tasks.md

docs/accessibility/
└── desktop-companions.md
```

### Source Code (repository root)

```text
agent/
├── Cargo.toml
├── lattice-tray.service
└── src/
    ├── bin/
    │   ├── lattice-capture.rs
    │   ├── lattice-tray.rs
    │   ├── lattice-tray-windows.rs
    │   └── lattice-config.rs
    ├── config_edit.rs
    ├── ipc.rs
    ├── ipc_client.rs
    ├── status.rs
    ├── platform.rs
    ├── icon.rs
    └── format.rs

install.sh
install.ps1
README.md
```

**Structure Decision**: Keep desktop companion behavior in `agent/src/bin/*` and shared local-only helpers in `agent/src/*`; keep platform installation in root installer scripts. Do not add spine or surface code unless tests uncover a contract mismatch in existing capture routes.

## Complexity Tracking

No constitution violations.

## Phase 0 Research

See [research.md](./research.md). Decisions: use local SQLite queue for quick capture durability, newline IPC for status/reindex, StatusNotifierItem/systemd on Linux, Task Scheduler/native tray path on Windows, `toml_edit` for config preservation, and plain text diagnostics/English-only N/A language rationale.

## Phase 1 Design

See [data-model.md](./data-model.md), [contracts/desktop-companions.md](./contracts/desktop-companions.md), and [quickstart.md](./quickstart.md).

## Post-Design Constitution Check

Re-check passes. The design adds no hosted services, preserves spine REST boundaries, stores companion state locally, uses existing bearer-token authentication, and keeps UI/diagnostics accessible through text labels and logs. Bilingual delivery remains N/A because no translated UI copy is introduced.
