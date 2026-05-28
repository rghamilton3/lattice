# Research: Windows Installer Release Asset Download Fix

## Decision: Resolve asset URLs from GitHub release metadata

**Rationale**: `install.ps1` currently fetches only the latest tag, then constructs `https://github.com/$Repo/releases/download/$Tag/$Asset`. The reported failure shows GitHub returning a `Page not found` HTML document for `lattice-agent-x86_64-pc-windows-msvc.exe`, so the installer should first verify that the asset exists in the release metadata and use the exact `browser_download_url`. This mirrors `install.sh`, which selects `.assets[] | select(.name == $name) | .browser_download_url` from the latest release API.

**Alternatives considered**: Keep manual URL construction and add `-ErrorAction Stop`; rejected because it still cannot distinguish missing assets from malformed URLs before download. Hard-code release asset URLs; rejected because latest releases change over time.

## Decision: Fail before download when an expected asset is absent

**Rationale**: The user-facing failure should name the missing asset and release tag instead of dumping GitHub's HTML page. The installer should stop if `lattice-agent`, `lattice-capture`, or non-skipped `lattice-tray` cannot be found in the latest release asset list.

**Alternatives considered**: Retry the same URL; rejected because a deterministic 404 from a missing asset will not recover. Continue installing partial binaries; rejected because scheduled tasks would point to incomplete or missing executables.

## Decision: Keep release workflow asset names as the contract source

**Rationale**: `.github/workflows/agent-release.yml` publishes the expected Windows assets with names matching `install.ps1`: `lattice-agent-x86_64-pc-windows-msvc.exe`, `lattice-tray-x86_64-pc-windows-msvc.exe`, and `lattice-capture-x86_64-pc-windows-msvc.exe`. Implementation should verify whether actual releases include those assets. If the workflow and installer disagree, fix the source that caused the mismatch.

**Alternatives considered**: Rename installed local filenames; rejected because local destination names are already stable (`lattice-agent.exe`, `lattice-capture.exe`, `lattice-tray.exe`) and are not the failing contract.

## Decision: Regression test the URL resolver without depending on live GitHub

**Rationale**: Network tests against the current latest release are brittle. The regression should parse or invoke helper behavior against representative release metadata that includes and omits expected asset names, asserting that present assets resolve and missing assets fail clearly.

**Alternatives considered**: Only run manual installer tests; rejected because this exact class of bug is easy to reintroduce. Full Windows install in CI; deferred unless CI already has an established Windows PowerShell test lane.

## Decision: Include CLI accessibility checks for installer output

**Rationale**: This bugfix changes user-facing terminal failure behavior. Output should be plain text, specific, copyable, and not dependent on color.

**Alternatives considered**: No accessibility review because this is a script; rejected by the A11Y governance preset for user-facing terminal output.
