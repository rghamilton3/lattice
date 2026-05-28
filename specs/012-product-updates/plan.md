# Implementation Plan: Product Updates

**Branch**: `012-product-updates` | **Date**: 2026-05-27 | **Spec**: [spec.md](./spec.md)

**Input**: Feature specification from `/specs/012-product-updates/spec.md`

## Summary

Deliver the first product update mechanism for Lattice by adding local update discovery, check-only status, explicit apply, artifact verification, user-state preservation, and attempt history to the Rust agent installation flow. Automatic updates are scoped to `lattice-agent` and installed desktop companions first; spine, surface, installers, service units, and other deployable products are reported with installed/latest/manual guidance rather than silently ignored. The implementation should reuse the existing GitHub release channel and local files, avoid new hosted services or runtime dependencies, and keep update diagnostics readable in terminals, service logs, and desktop notifications.

## Technical Context

**Language/Version**: Rust 2024 edition for local update CLI/agent helpers and desktop companions; Bash for Linux installer integration; PowerShell for Windows installer/status guidance; TypeScript/Bun/SvelteKit remain relevant only if server/surface products are reported through manual guidance docs

**Primary Dependencies**: Existing agent crates `reqwest`, `serde`, `serde_json`, `toml`, `toml_edit`, `rusqlite`, `tokio`, `tracing`, `notify-rust`, optional `eframe`, Unix `ksni`, Windows `tray-icon`; existing release assets from `.github/workflows/agent-release.yml`; system tools `systemctl --user`, `journalctl`, Task Scheduler, `curl`, and `jq` in installer paths

**Storage**: Local update attempt history and staged artifacts under the platform data directory (`~/.local/share/lattice` on Linux, `%LOCALAPPDATA%\lattice` on Windows); existing config TOML remains under platform config directory; no new spine tables, no vector-store changes, and no hosted persistence

**Testing**: `cargo test --manifest-path agent/Cargo.toml`; targeted Rust tests for discovery, metadata parsing, version comparison, staged artifact verification, state preservation, and attempt history; `bash -n install.sh`; PowerShell parser validation for `install.ps1` when available; `just lint` and `just check` before merge; scripted smoke tests in quickstart for check-only, successful update, failed verification, interrupted update, and capture queue preservation

**Target Platform**: User-controlled Linux desktop/laptop installs with systemd user services and installed binaries in `~/.local/bin`; Windows desktop installs under `%LOCALAPPDATA%\lattice` with Task Scheduler; self-hosted Lattice deployment for server/surface products reported as manual-update targets

**Project Type**: Local desktop/CLI updater plus installer integration and release-contract documentation; no new spine API or surface UI in the first slice

**Performance Goals**: Check-only status completes quickly enough for terminal use under normal connectivity; an older configured agent updates within 5 minutes; quick capture works within 30 seconds after companion update; failed or offline checks preserve installed versions and local state immediately

**Constraints**: No new mandatory hosted service, account, telemetry, or private-content transmission; no new runtime dependencies unless later justified; do not overwrite config, queues, caches, service customizations, or user data by default; verify artifacts before replacement; require explicit operator action before replacing binaries; preserve plain-text diagnostics without color/icon-only state; keep automatic update scope limited to agent and desktop companions until other products have concrete update/install contracts

**Scale/Scope**: Single-user local Lattice installations with one agent and optional desktop companions per machine. Out of scope for this slice: fully automatic background self-updates, multi-user fleet orchestration, package-manager integration, signed artifact infrastructure beyond checksums available from the approved release metadata, and automatic spine/surface deployment updates.

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

| Principle | Gate Question | Pass / Violation |
|-----------|---------------|------------------|
| I. Self-Hosting First | Does this feature add a mandatory external service (cloud DB, hosted API, SaaS auth)? | Pass - uses the existing public release channel already used by installers; no new account or hosted Lattice service is required |
| II. Component Boundaries | Does this feature introduce cross-component coupling beyond REST API contracts? | Pass - local updater only manipulates local agent/companion installs and reports manual guidance for other products; no direct spine/surface imports |
| III. Local-First Data | Does this feature store user data outside user-controlled SQLite/local files? | Pass - update history, staging, config, queues, and caches remain in per-user local files |
| IV. Security by Design | Does this feature add a new route group without a declared auth model? | Pass - no new route group; update metadata uses release artifacts and does not change bearer-token spine APIs |
| V. Simplicity over Abstraction | Does this feature introduce an abstraction with fewer than 3 concrete callsites? | Pass - keep updater code in direct agent modules and installer scripts; avoid a generic product framework beyond the products actually reported |
| V. Simplicity over Abstraction | Does this feature introduce an ORM, feature flag, or backwards-compat shim without a shipped external dependency or persisted-data migration requiring it? | Pass - no ORM or feature flag; any update-history schema is local and additive |
| Tech Stack | Does this feature add a runtime dependency outside the approved technology stack? | Pass - planned around existing Rust crates, installer tools, and release workflow |

## Project Structure

### Documentation (this feature)

```text
specs/012-product-updates/
├── spec.md
├── plan.md
├── research.md
├── data-model.md
├── quickstart.md
├── contracts/
│   ├── update-cli.md
│   └── release-artifacts.md
└── tasks.md

docs/accessibility/
└── product-updates.md
```

### Source Code (repository root)

```text
agent/
├── Cargo.toml
├── lattice-agent.service
├── lattice-tray.service
└── src/
    ├── bin/
    │   ├── main.rs
    │   ├── lattice-capture.rs
    │   ├── lattice-tray.rs
    │   ├── lattice-tray-windows.rs
    │   └── lattice-config.rs
    ├── update.rs              # local product discovery, metadata, staging, verification, apply, history
    ├── platform.rs            # platform install/data path helpers reused by updater
    ├── config.rs              # config path preservation checks
    └── status.rs              # optional update status text reused by tray diagnostics

install.sh                     # install/update entry point and Linux manual guidance
install.ps1                    # Windows install/update entry point and manual guidance
.github/workflows/agent-release.yml
README.md
agent/README.md
```

**Structure Decision**: Implement product updates in the local Rust agent/install surface because the highest-priority products are local binaries and their user state already lives beside agent config, cache, queue, and service definitions. Keep release metadata and artifact naming documented as contracts, not a new server component. Do not add spine or surface code unless later tasks decide to expose a persistent web update control; if that happens, add `docs/accessibility/product-updates.md` evidence for the control.

## Complexity Tracking

No constitution violations.

## Phase 0: Research

See [research.md](./research.md). Decisions resolve update scope, release metadata/artifact source, artifact verification, local state preservation, service restart behavior, update history storage, non-agent product reporting, failure/interruption handling, and A11Y/language governance.

## Phase 1: Design & Contracts

See [data-model.md](./data-model.md), [contracts/update-cli.md](./contracts/update-cli.md), [contracts/release-artifacts.md](./contracts/release-artifacts.md), and [quickstart.md](./quickstart.md).

## Post-Design Constitution Check

| Principle | Result |
|-----------|--------|
| Self-Hosting First | Pass - update checks reuse the existing release channel and remain optional/manual; Lattice does not add a new hosted account or service dependency |
| Component Boundaries | Pass - automatic update work stays within local agent/installer boundaries; other products are documented as manual guidance rather than coupled directly |
| Local-First Data | Pass - update history and staged artifacts are local files; user config, queues, caches, and service state are preserved locally |
| Security by Design | Pass - no new network route or auth model is introduced; artifact verification and explicit apply guard binary replacement |
| Simplicity over Abstraction | Pass - direct Rust modules and installer script changes are sufficient for the concrete agent/desktop companion slice |
| Approved Stack | Pass - no new runtime dependency is planned |

## A11Y / Language Plan

- Review every terminal, installer, service-log, update-history, and notification message for plain-language product, outcome, and next-action text.
- Add CLI accessibility checks for check-only, successful update, failed verification, offline metadata, interrupted update, and manual-guidance output; status must not rely on color, symbols, icons, or transient notifications alone.
- If tray/config GUI update controls are added in implementation, verify keyboard access, visible focus, labels, and non-color-only state against WCAG 2.2 AA and record evidence in `docs/accessibility/product-updates.md`.
- Bilingual content work is N/A for this feature because current Lattice installer and diagnostic copy is English-only and no translation resource is in scope; document that N/A decision in the accessibility evidence.
