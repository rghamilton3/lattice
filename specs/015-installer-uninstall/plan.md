# Implementation Plan: Installer Uninstall Option

**Branch**: `015-installer-uninstall` | **Date**: 2026-06-01 | **Spec**: [spec.md](./spec.md)

**Input**: Feature specification from `specs/015-installer-uninstall/spec.md`

## Summary

Add explicit uninstall paths to the existing root installer scripts so users can reverse a local Lattice installation without manual cleanup. The implementation should keep install behavior unchanged, remove installer-managed executables and launch registrations, preserve user configuration by default, provide an explicit complete-removal path, and report plain-text uninstall results.

## Technical Context

**Language/Version**: Bash for `install.sh`; PowerShell script for `install.ps1`

**Primary Dependencies**: Existing shell commands used by the installers; `systemctl --user` and `loginctl` paths on Linux where present; Windows Task Scheduler through `schtasks.exe`; no new runtime dependencies

**Storage**: Local installer-managed binary, service/task, and configuration paths only; default uninstall preserves user configuration under existing config locations

**Testing**: Add script-level regression coverage for uninstall helpers; run PowerShell parser validation when `pwsh` is available; run Bash syntax validation; run `just lint`/`just check` only if implementation touches broader project files

**Target Platform**: Existing desktop installer targets: Linux user install path through `install.sh` and Windows user install path through `install.ps1`

**Project Type**: Monorepo installer feature touching root installer scripts and installer-focused regression tests/documentation

**Performance Goals**: Uninstall completes in one local operation with no network calls; already-missing artifacts should be skipped without user-noticeable delay

**Constraints**: Preserve current install-only usage; preserve configuration by default; no network access for uninstall; no new runtime dependencies; output must be plain text, copyable, and non-color-dependent; bilingual content remains out of scope for current English-only installer scripts

**Scale/Scope**: Two root installer scripts, current installer-managed binaries, Linux user services, Windows scheduled tasks, optional capture/tray/config helper components, and local config locations

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

| Principle | Gate Question | Pass / Violation |
|-----------|--------------|-----------------|
| I. Self-Hosting First | Does this feature add a mandatory external service (cloud DB, hosted API, SaaS auth)? | Pass - uninstall is local-only and removes existing local artifacts |
| II. Component Boundaries | Does this feature introduce cross-component coupling beyond REST API contracts? | Pass - installer scripts remain deployment tooling and do not add runtime component coupling |
| III. Local-First Data | Does this feature store user data outside user-controlled SQLite/local files? | Pass - no new storage; config is preserved locally by default |
| IV. Security by Design | Does this feature add a new route group without a declared auth model? | Pass - no routes or auth changes |
| V. Simplicity over Abstraction | Does this feature introduce an abstraction with fewer than 3 concrete callsites? | Pass - plan favors direct script helpers scoped to repeated remove/report steps inside each installer |
| V. Simplicity over Abstraction | Does this feature introduce an ORM, feature flag, or backwards-compat shim without a shipped external dependency or persisted-data migration requiring it? | Pass - no ORM, feature flag, compatibility shim, or migration |
| Tech Stack | Does this feature add a runtime dependency outside the approved technology stack? | Pass - uses existing shell/PowerShell and platform tools only |

## Project Structure

### Documentation (this feature)

```text
specs/015-installer-uninstall/
├── spec.md
├── plan.md
├── research.md
├── data-model.md
├── quickstart.md
├── checklists/
│   └── requirements.md
└── contracts/
    └── uninstall-cli.md
```

### Source Code (repository root)

```text
install.sh                         # Linux installer and uninstall option
install.ps1                        # Windows installer and uninstall option
tests/                             # add installer-focused script tests if needed for uninstall helpers
specs/015-installer-uninstall/     # planning, contracts, and validation documentation
```

**Structure Decision**: Keep uninstall behavior inside the existing installer scripts rather than adding a separate installer framework. Add only focused tests/docs needed to validate uninstall behavior and preserve install-only behavior.

## Complexity Tracking

No constitution violations.

## Phase 0: Research

See [research.md](./research.md). Decisions resolve uninstall invocation shape, default configuration retention, platform cleanup behavior, idempotency, validation strategy, accessibility, and bilingual scope.

## Phase 1: Design & Contracts

See [data-model.md](./data-model.md), [contracts/uninstall-cli.md](./contracts/uninstall-cli.md), and [quickstart.md](./quickstart.md).

## Post-Design Constitution Check

| Principle | Result |
|-----------|--------|
| Self-Hosting First | Pass - uninstall remains local-only and does not add hosted services |
| Component Boundaries | Pass - installer cleanup does not alter spine/surface/agent communication boundaries |
| Local-First Data | Pass - user configuration remains local and preserved by default |
| Security by Design | Pass - no routes, auth, token validation, or privilege model changes |
| Simplicity over Abstraction | Pass - design uses existing scripts and direct cleanup helpers, with no framework or speculative compatibility layer |
| Approved Stack | Pass - no new runtime dependencies |

## A11Y / Language Plan

- Review all new uninstall prompts, status lines, warnings, and summaries for plain-text clarity.
- Ensure CLI output does not depend on color, animation, icons, glyph-only symbols, or terminal-specific formatting to convey meaning.
- Include validation cases for copyable failure messages that name the affected component and next action.
- Keep bilingual content work out of scope for this feature because existing installer scripts and docs are English-only and no translation resource exists; document that decision in quickstart validation notes.
