# Implementation Plan: Windows Installer Release Asset Download Fix

**Branch**: `bugfix/001-windows-installer-produces` | **Date**: 2026-05-28 | **Spec**: [bug-report.md](./bug-report.md)

**Input**: Bug report from `specs/bugfix-001-windows-installer-produces/bug-report.md`

## Summary

Fix the Windows installer so it downloads GitHub release assets through the release API's `browser_download_url` values instead of constructing release download URLs manually. The Linux installer already resolves assets by name from the latest release API and fails clearly when an asset is absent; the Windows installer should use the same asset-resolution behavior and add a regression check for missing/renamed assets before attempting `Invoke-WebRequest`.

## Technical Context

**Language/Version**: PowerShell installer script for Windows; GitHub Actions YAML for release asset publication if investigation proves asset names differ from installer expectations

**Primary Dependencies**: Built-in PowerShell `Invoke-RestMethod`, `Invoke-WebRequest`, existing GitHub Releases API, existing release workflow `.github/workflows/agent-release.yml`

**Storage**: N/A; installer writes binaries to `%LOCALAPPDATA%\lattice` and config to `%APPDATA%\lattice`, but this fix does not change persisted config shape

**Testing**: Add script-level regression validation for `install.ps1` asset URL resolution; run PowerShell parser validation when `pwsh` is available; run `just lint`/`just check` only if touched files or CI expectations require broader validation

**Target Platform**: Windows PowerShell / PowerShell Core installer downloading assets from GitHub Releases for the `rghamilton3/lattice` repository

**Project Type**: Monorepo installer/release bugfix touching root installer script and possibly release workflow documentation/tests

**Performance Goals**: Asset lookup adds only one GitHub API call for the latest release metadata and no user-noticeable delay compared with the current latest-tag lookup

**Constraints**: No new runtime dependency, no hosted service beyond existing GitHub release hosting, preserve existing install directories, preserve `-SkipTray`, preserve clear user-facing terminal output, fail before writing invalid 404 HTML to binary destinations

**Scale/Scope**: Single Windows installer path for three assets: `lattice-agent-x86_64-pc-windows-msvc.exe`, `lattice-capture-x86_64-pc-windows-msvc.exe`, and optional `lattice-tray-x86_64-pc-windows-msvc.exe`

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

| Principle | Gate Question | Pass / Violation |
|-----------|--------------|-----------------|
| I. Self-Hosting First | Does this feature add a mandatory external service (cloud DB, hosted API, SaaS auth)? | Pass - continues using existing GitHub release distribution already used by installers |
| II. Component Boundaries | Does this feature introduce cross-component coupling beyond REST API contracts? | Pass - installer remains a deployment script and does not couple spine/surface/agent internals |
| III. Local-First Data | Does this feature store user data outside user-controlled SQLite/local files? | Pass - no user data storage changes |
| IV. Security by Design | Does this feature add a new route group without a declared auth model? | Pass - no route or auth changes |
| V. Simplicity over Abstraction | Does this feature introduce an abstraction with fewer than 3 concrete callsites? | Pass - a direct `Get-ReleaseAssetUrl` helper has three concrete binary callsites and mirrors `install.sh` |
| V. Simplicity over Abstraction | Does this feature introduce an ORM, feature flag, or backwards-compat shim without a shipped external dependency or persisted-data migration requiring it? | Pass - no ORM, flags, compatibility shim, or migration |
| Tech Stack | Does this feature add a runtime dependency outside the approved technology stack? | Pass - uses built-in PowerShell and existing GitHub Releases API only |

## Project Structure

### Documentation (this feature)

```text
specs/bugfix-001-windows-installer-produces/
├── bug-report.md
├── plan.md
├── research.md
├── data-model.md
├── quickstart.md
└── contracts/
    └── windows-installer-assets.md
```

### Source Code (repository root)

```text
install.ps1                         # resolve assets from latest release metadata before download
.github/workflows/agent-release.yml # verify expected Windows asset names if release mismatch is found
specs/bugfix-001-windows-installer-produces/ # planning and validation documentation
```

**Structure Decision**: Keep the fix in `install.ps1` unless implementation proves release publication is the source of the missing asset. Do not add a new installer framework or dependency.

## Complexity Tracking

No constitution violations.

## Phase 0: Research

See [research.md](./research.md). Decisions resolve how to obtain release asset URLs, how to fail on missing assets, what release workflow assumptions must hold, and what regression checks can run without network-dependent tests.

## Phase 1: Design & Contracts

See [data-model.md](./data-model.md), [contracts/windows-installer-assets.md](./contracts/windows-installer-assets.md), and [quickstart.md](./quickstart.md).

## Post-Design Constitution Check

| Principle | Result |
|-----------|--------|
| Self-Hosting First | Pass - no new mandatory service beyond existing GitHub release distribution |
| Component Boundaries | Pass - installer downloads agent binaries but does not introduce runtime component coupling |
| Local-First Data | Pass - no user data or database changes |
| Security by Design | Pass - no route, auth, token, or privilege model changes |
| Simplicity over Abstraction | Pass - minimal helper for three direct asset downloads; no speculative framework |
| Approved Stack | Pass - no new runtime dependencies |

## A11Y / Language Plan

- Review installer terminal output for clear plain-text status and failure messages, including missing asset name and release tag.
- Ensure error output does not rely on color or formatting to convey failure.
- Keep messages concise for screen-reader and copy/paste diagnostics.
- Bilingual content work is not in scope because current installer documentation and prompts are English-only and no translation resource exists for this bugfix.
