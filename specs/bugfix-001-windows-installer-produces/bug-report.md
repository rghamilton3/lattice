# Bug Report: Windows installer downloads GitHub 404 page instead of binary

**Bug ID**: bugfix-001
**Branch**: `bugfix/001-windows-installer-produces`
**Created**: 2026-05-28
**Severity**: [ ] Critical | [x] High | [ ] Medium | [ ] Low
**Component**: Windows installer / release binary download
**Status**: [ ] Investigating | [x] Root Cause Found | [x] Fixed | [x] Verified

## Input
User description: "Windows installer produces an Invoke-WebRequest error while downloading lattice-agent-x86_64-pc-windows-msvc.exe for latest release tag agent-v0.10.0. The response body is GitHub's Page not found HTML instead of the expected binary asset."

## Current Behavior
The Windows installer starts normally, fetches latest release tag `agent-v0.10.0`, creates install directories, then fails while downloading `lattice-agent-x86_64-pc-windows-msvc.exe`.

PowerShell reports an `Invoke-WebRequest` failure at `C:\Users\rhamilton\install.ps1:54`:

```powershell
Invoke-WebRequest -Uri $url -OutFile $Dest -UseBasicParsing
```

The response content is GitHub's `Page not found · GitHub · GitHub` HTML page, indicating the installer is requesting a URL that does not resolve to the Windows binary asset.

## Expected Behavior
The Windows installer should resolve the correct download URL for the latest release's Windows binary, download `lattice-agent-x86_64-pc-windows-msvc.exe`, and continue installation without writing or displaying GitHub 404 HTML.

## Reproduction Steps
1. On Windows, run the Lattice Agent installer PowerShell script.
2. Allow the script to fetch the latest release tag.
3. Observe that the script selects `agent-v0.10.0` and attempts to download `lattice-agent-x86_64-pc-windows-msvc.exe`.
4. Observe `Invoke-WebRequest` fail at the binary download step with GitHub `Page not found` HTML in the response.

**Frequency**: [x] Always | [ ] Sometimes | [ ] Rare
**Environment**: Windows PowerShell installer

## Root Cause Analysis
*Filled during investigation (before running /speckit.plan)*

**Technical Explanation**:
`install.ps1` gets the latest release tag, then manually constructs GitHub release download URLs from `$Repo`, `$Tag`, and `$Asset`. The reported failure indicates that the constructed URL for `lattice-agent-x86_64-pc-windows-msvc.exe` resolves to GitHub's 404 HTML page for `agent-v0.10.0`. Unlike `install.sh`, the Windows installer does not verify that the named asset exists in the latest release metadata or use the API-provided `browser_download_url`.

**Files Involved**:
- `install.ps1`: `Get-LatestTag` and `Download-Asset` construct and download release asset URLs.
- `.github/workflows/agent-release.yml`: publishes the Windows release assets that the installer expects.

**Related Features**:
- `specs/009-desktop-companions` documents installer and desktop companion behavior.

## Fix Strategy
*Filled during /speckit.plan (planning phase)*

**Approach**:
Update `install.ps1` to resolve asset download URLs from the latest release API response by exact asset name, fail clearly when an expected asset is missing, and only call `Invoke-WebRequest` with an API-provided `browser_download_url`. Add regression coverage for the resolver behavior before implementing the fix.

**Files to Modify**:
- `install.ps1` - replace manual URL construction with release metadata asset lookup and clear missing-asset errors.
- `.github/workflows/agent-release.yml` - only if investigation shows the published asset names differ from installer expectations.

**Breaking Changes**: [ ] Yes | [x] No

## Regression Test
*Created during /speckit.tasks and /speckit.implement (BEFORE applying fix)*

- [x] Test written that reproduces bug (fails before fix)
- [x] Test passes after fix applied
- [x] Test added to test suite (not orphaned)
- [x] Test covers edge cases identified during investigation

**Test File**: `tests/windows-installer-assets.ps1`
**Test Description**: Loads the installer helper behavior without running the installer, verifies agent, capture, and tray assets resolve to release metadata `browser_download_url` values, verifies missing required assets fail with the asset name and release tag before download, and verifies `-SkipTray` skips tray asset lookup.

PowerShell regression execution passed with `pwsh -NoProfile -File tests/windows-installer-assets.ps1`. PowerShell parser validation for `install.ps1` passed. Repository-level `just lint` and `just check` passed after installing existing Surface lockfile dependencies locally.

## Verification Checklist
- [ ] Bug reproduced in clean environment
- [x] Root cause identified and documented
- [x] Fix implemented
- [x] Regression test passes
- [x] Existing tests still pass
- [ ] Manual verification complete
- [x] Related documentation updated (if needed)

## Related Issues/Bugs
None identified yet.

## Prevention
The Windows installer now resolves release assets by exact name from GitHub release metadata and uses API-provided `browser_download_url` values. The regression test covers present assets, missing required assets, and skipped optional tray lookup so manual URL construction regressions are easier to catch.

---
*Bug report created using `/bugfix` workflow - See .specify/extensions/workflows/bugfix/*
