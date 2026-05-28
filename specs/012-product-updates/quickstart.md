# Quickstart: Product Updates

This quickstart defines the expected verification flow for the first product update slice.

## 1. Build Local Agent Binaries

```bash
cargo build --manifest-path agent/Cargo.toml --release --features gui --bin lattice-agent --bin lattice-capture --bin lattice-tray --bin lattice-config
```

Windows companion verification uses the Windows release build path from `.github/workflows/agent-release.yml`.

## 2. Prepare An Older Test Install

Install an older `lattice-agent` and optional desktop companions into the normal user install directory.

Linux paths:

```text
~/.local/bin/lattice-agent
~/.local/bin/lattice-capture
~/.local/bin/lattice-tray
~/.local/bin/lattice-config
~/.config/lattice/config.toml
~/.local/share/lattice/agent.db
~/.local/share/lattice/queue.db
```

Windows paths:

```text
%LOCALAPPDATA%\lattice\lattice-agent.exe
%LOCALAPPDATA%\lattice\lattice-capture.exe
%LOCALAPPDATA%\lattice\lattice-tray.exe
%APPDATA%\lattice\config.toml
%LOCALAPPDATA%\lattice\queue.db
```

Add at least one queued capture before applying an update so preservation is observable.

## 3. Check Status Without Applying

```bash
lattice-agent update check
```

Verify:

- Each recognized product is listed.
- Agent and installed desktop companions report current or update-available status.
- Spine/surface or unknown products show manual guidance rather than success.
- No binary, config, queue, cache, or service definition changes.
- Output is understandable without color or icon-only state.

## 4. Apply Agent And Desktop Companion Updates

```bash
lattice-agent update apply --all-supported
```

Verify:

- The command shows product, installed version, target version, and summary before replacement.
- Operator confirmation is required.
- Artifacts are staged and verified before installed files are replaced.
- `lattice-agent` restarts or prints exact restart instructions.
- Desktop companions still launch after update.
- `lattice-capture "post-update smoke"` completes within 30 seconds.
- Existing config, `agent.db`, `queue.db`, and service customizations are preserved.

## 5. Verify Failed Artifact Protection

Stage or simulate a corrupted artifact, then run apply.

Expected result:

- Update fails with `failed-verification`.
- Installed product files remain unchanged.
- History records product, versions, outcome, time, and next action.
- Output identifies the failed product and recovery step in plain text.

## 6. Verify Interrupted Update Preservation

Interrupt the update after staging but before completion.

Expected result:

- Config and queued capture text remain intact.
- Existing product remains usable when replacement did not start.
- If replacement started, history and output provide roll-forward or reinstall instructions.

## 7. Review History

```bash
lattice-agent update history
```

Verify successful, skipped, offline, failed-verification, and interrupted attempts are visible with product, starting version, target version, outcome, timestamp, and next action.

## 8. Installer Script Checks

```bash
bash -n install.sh
cargo test --manifest-path agent/Cargo.toml
just lint
just check
```

Run PowerShell parser validation for `install.ps1` where PowerShell is available.

## Accessibility Evidence

Record evidence in `docs/accessibility/product-updates.md` for terminal, installer, service-log, notification, and any persistent desktop/web controls introduced during implementation.

Minimum evidence:

- Check-only output is readable as plain text.
- Confirmation and failure states do not rely on color or transient notification only.
- Failed verification and interrupted update recovery instructions are present.
- Bilingual delivery is documented as N/A because current Lattice setup and diagnostic copy is English-only and no translation resource is in scope.
