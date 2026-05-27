# lattice-agent

<img src="../surface/static/favicon.svg" width="48" alt="Lattice icon">

[![CI lattice-agent](https://github.com/rghamilton3/lattice/actions/workflows/agent-ci.yml/badge.svg)](https://github.com/rghamilton3/lattice/actions/workflows/agent-ci.yml)
[![Release lattice-agent](https://github.com/rghamilton3/lattice/actions/workflows/agent-release.yml/badge.svg)](https://github.com/rghamilton3/lattice/actions/workflows/agent-release.yml)

Local file indexer for the Lattice knowledge system. Polls configured directories, extracts
text, hashes files, and posts changed content to the spine for embedding and search.

## How it works

On each poll cycle the agent:

1. Walks every `[[watch]]` directory, skipping hidden files/directories.
2. Stats each matching file; skips if `mtime + size` match the local cache (no hashing needed).
3. Hashes changed files with BLAKE3; skips if the hash is unchanged.
4. Extracts text — plain text/markdown directly, PDF via `pdftotext`, others skipped.
5. POSTs `{ machine_id, path, hash, mime_type, text, modified_at, size_bytes }` to
   `POST /api/agent/index` on the spine with a bearer-token header.
6. Records the file in the local dedup cache only on a successful POST.

If the spine is unreachable the file is not cached, so it will be retried next cycle.

## Install

```bash
bash <(curl -fsSL https://raw.githubusercontent.com/rghamilton3/lattice/main/install.sh)
```

The script detects your architecture (x86\_64 or aarch64), downloads the latest release binary,
optionally installs `lattice-capture` and `lattice-tray`, writes `~/.config/lattice/config.toml`,
and enables the systemd user service. Requires `curl` and `jq`.

**Optional runtime dependency:** `pdftotext` (poppler-utils) for PDF indexing.
On Arch: `sudo pacman -S poppler`. Without it, PDF files are skipped with an error log line.

### Manual setup (development)

```bash
cargo build --release
cp target/release/lattice-agent ~/.local/bin/
cp target/release/lattice-tray ~/.local/bin/
mkdir -p ~/.config/systemd/user
cp lattice-agent.service lattice-tray.service ~/.config/systemd/user/
systemctl --user daemon-reload
systemctl --user enable --now lattice-agent lattice-tray
```

## Tray icon (lattice-tray)

`lattice-tray` is a companion binary that shows the agent's status in the system tray. It
communicates with the agent over a Unix socket at `$XDG_RUNTIME_DIR/lattice-agent.sock`.

**Tray menu:**

- Status line — scan state, last scan time, files indexed/skipped
- Spine reachability — reflects the last scan attempt, not a live ping
- Last error — shown only when errors occurred in the last pass
- Stop / Start Agent — toggles based on whether the agent is running
- Restart Agent — restarts the systemd service
- Capture… — launches `lattice-capture` (prompts via walker/wofi/rofi)
- Configure… — launches the `lattice-config` editor
- Exit — stops the agent and quits the tray

## Quick capture (lattice-capture)

`lattice-capture` is a small companion binary for sending quick text captures to the spine
(e.g. bound to a global hotkey). It reads the spine URL and agent token from the same
`config.toml` and queues captures locally at `~/.local/share/lattice/queue.db` when the
spine is unreachable, draining the queue on the next successful run.

```bash
lattice-capture "some thought"          # arg form, for hotkeys
echo "some thought" | lattice-capture   # pipe form
lattice-capture                         # interactive — uses walker/wofi/rofi --dmenu
```

**Prerequisites:** your panel must support the StatusNotifierItem protocol.
On Hyprland, enable waybar's `"tray"` module in your waybar config.

### Local cache

The dedup cache lives at `~/.local/share/lattice/agent.db` (SQLite). Delete it to force
a full re-index on next run.

### Logging

Set `RUST_LOG=lattice_agent=debug` (in the service file or environment) for verbose output.

## Product updates

The local updater checks the existing GitHub release channel and never sends private content, config, queue, cache, or indexed data. Checks are read-only; applying updates requires explicit confirmation.

```bash
lattice-agent update check
lattice-agent update apply lattice-agent
lattice-agent update apply desktop-companions
lattice-agent update apply --all-supported
lattice-agent update history
```

`update check` prints one plain-text line per recognized product with installed version, latest version, status, and next action. Agent and installed desktop companions can be updated automatically when a matching platform artifact and BLAKE3 checksum are available. Spine, surface, installer scripts, service units, unknown products, and development builds are reported with manual guidance instead of being replaced automatically.

`update apply lattice-agent` replaces only the installed agent binary after staging and checksum verification. `update apply desktop-companions` updates installed `lattice-capture`, `lattice-tray`, and `lattice-config` companions. `update apply --all-supported` includes the agent and installed desktop companions. Config, `agent.db`, `queue.db`, update history, caches, and service definitions are preserved.

If verification fails, the updater records `failed-verification`, leaves the installed binary unchanged, and prints a recovery step. If release metadata is offline, no files are changed and the attempt is recorded as `offline`. After a successful agent update, restart the service with `systemctl --user restart lattice-agent` on Linux or restart the `LatticeAgent` scheduled task on Windows.
