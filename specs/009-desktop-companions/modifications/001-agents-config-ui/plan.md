# Implementation Plan: Config UI Watch Path File Picker

**Branch**: `009-mod-001-agents-config-ui` | **Date**: 2026-05-26 | **Spec**: [modification-spec.md](./modification-spec.md)

**Input**: Modification specification from `specs/009-desktop-companions/modifications/001-agents-config-ui/modification-spec.md`

## Summary

Add picker-assisted watch-path selection to the Rust `lattice-config` GUI while preserving manual path editing, existing TOML shape, config validation, atomic saves, and reindex/restart behavior. The implementation will keep the change local to the desktop companion UI, use the same in-memory watch row state as typed paths, and document the picker behavior as a delta to the original Desktop Companions contracts.

## Technical Context

**Language/Version**: Rust 2024 edition for desktop companion changes; Markdown for Spec Kit docs and accessibility evidence

**Primary Dependencies**: Existing optional `eframe` GUI feature for `lattice-config`; planned optional Rust GUI dependency `rfd` for native folder selection if implementation confirms `eframe`/egui has no built-in native file dialog

**Storage**: Existing platform config TOML only; no new file format, database table, or migration

**Testing**: `cd agent && cargo test`; `cd agent && cargo test --features gui`; targeted config editor state tests where current UI code permits; manual smoke for picker select/cancel behavior

**Target Platform**: User-controlled Linux and Windows desktops where the existing `lattice-config` GUI feature is available

**Project Type**: Local desktop GUI companion enhancement

**Performance Goals**: Picker selection updates a watch row immediately after a successful selection; cancel/failure returns without blocking save/cancel controls or mutating the prior path

**Constraints**: Preserve manual path editing or accessible fallback; preserve readable TOML/comments where existing config editor supports it; no spine, Surface, IPC, queue, installer, or service contract changes unless dependency packaging requires a direct update; no cloud or hosted dependency; diagnostics must be plain text and not color/icon-only

**Scale/Scope**: One configuration window, watch-directory rows only, single-user local config files; out of scope are path normalization redesign, recursive path browsing UI, watch-pattern picker UI, and new agent/spine behavior

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

| Principle | Gate Question | Pass / Violation |
|-----------|--------------|-----------------|
| I. Self-Hosting First | Does this feature add a mandatory external service (cloud DB, hosted API, SaaS auth)? | Pass - native picker runs locally and adds no service |
| II. Component Boundaries | Does this feature introduce cross-component coupling beyond REST API contracts? | Pass - change is local to `agent/`; no REST, spine, or Surface coupling changes |
| III. Local-First Data | Does this feature store user data outside user-controlled SQLite/local files? | Pass - watch paths continue to save to the existing local TOML config |
| IV. Security by Design | Does this feature add a new route group without a declared auth model? | Pass - no routes are added |
| V. Simplicity over Abstraction | Does this feature introduce an abstraction with fewer than 3 concrete callsites? | Pass - use direct button/result handling in the existing config UI rather than a new abstraction |
| V. Simplicity over Abstraction | Does this feature introduce an ORM, feature flag, or backwards-compat shim without a shipped external dependency or persisted-data migration requiring it? | Pass - no ORM, feature flag, or compatibility shim planned |
| Tech Stack | Does this feature add a runtime dependency outside the approved technology stack? | Pass with tracking - a local optional Rust GUI crate may be added inside the existing `gui` feature and is justified below |

## Project Structure

### Documentation (this modification)

```text
specs/009-desktop-companions/modifications/001-agents-config-ui/
├── modification-spec.md
├── impact-analysis.md
├── plan.md
├── research.md
├── data-model.md
├── quickstart.md
└── contracts/
    └── desktop-companions.md
```

### Source Code (repository root)

```text
agent/
├── Cargo.toml                         # only if `rfd` or another approved local picker crate is required
└── src/
    ├── bin/
    │   └── lattice-config.rs          # picker button, result handling, UI state, GUI tests
    └── config_edit.rs                 # existing validation/save path; expected unchanged except tests if needed

docs/accessibility/
└── desktop-companions.md              # picker label, keyboard/fallback, and diagnostics evidence

specs/009-desktop-companions/
├── contracts/desktop-companions.md    # fold in config editor behavior delta during implementation/tasks
└── tasks.md                           # add picker implementation/test/docs tasks
```

**Structure Decision**: Keep the implementation in the existing `lattice-config` binary. Add the picker as a per-watch-row UI control that writes into the same path string field used by manual editing so `config_edit.rs` continues to own validation, TOML preservation, and atomic saving.

## Complexity Tracking

| Complexity | Why Needed | Simpler Alternative Rejected Because |
|------------|------------|--------------------------------------|
| Optional `rfd` dependency under the existing `gui` feature, pending implementation confirmation | `eframe`/egui provides the GUI shell but does not provide a cross-platform native folder dialog in the current dependency set; the user specifically requested a file picker rather than text-only input | Keeping text-only input fails the modification; building a custom path browser is more code and less native; shelling out to platform commands such as `zenity`/PowerShell is less portable and harder to test |

## Phase 0: Research

See [research.md](./research.md). Decisions resolve picker mechanism, manual fallback, state handling, validation boundaries, dependency scope, accessibility evidence, bilingual copy, and CLI accessibility applicability.

## Phase 1: Design & Contracts

See [data-model.md](./data-model.md), [contracts/desktop-companions.md](./contracts/desktop-companions.md), and [quickstart.md](./quickstart.md).

## Post-Design Constitution Check

Re-check passes. The design adds no hosted service, no new route group, no new cross-component channel, and no new persisted data shape. The only tracked complexity is a possible optional Rust GUI dependency scoped to the existing `gui` feature and justified above; if implementation discovers an existing approved picker API, that dependency should be omitted.

## A11Y / Language Plan

- Accessibility review work: verify the watch path picker button has understandable text, is reachable through the GUI toolkit's keyboard/focus model where supported, does not rely on icon-only state, and leaves manual text editing or a clear fallback available.
- Plain text diagnostics: picker cancel must be safe and silent or status text must explain that no path changed; picker failure or unsupported environments must produce actionable text if user action is needed.
- CLI accessibility checks: no user-facing terminal output is planned. If implementation adds terminal diagnostics around picker availability or launch failure, verify they are readable plain text and not color-only.
- Bilingual content work: remains N/A for this modification because the original Desktop Companions feature is English-only local companion copy with no translation framework. Record this N/A decision in `docs/accessibility/desktop-companions.md` when evidence is updated.
