# lattice-agent

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

## Setup

### 1. Build

```bash
cargo build --release
cp target/release/lattice-agent ~/.local/bin/
```

Requires poppler-utils for PDF support (`sudo pacman -S poppler` on Arch).

### 2. Configure

The agent shares `~/.config/lattice/config.toml` with `lattice-capture`. If you've already
set that up, just add an `[agent]` section and one or more `[[agent.watch]]` blocks.

```bash
mkdir -p ~/.config/lattice
cp ../config.toml.example ~/.config/lattice/config.toml
$EDITOR ~/.config/lattice/config.toml
```

Required: `spine.url`, `spine.agent_token`, at least one `[[agent.watch]]` block.

### 3. Run as a user systemd service

```bash
mkdir -p ~/.config/systemd/user
cp lattice-agent.service ~/.config/systemd/user/
systemctl --user daemon-reload
systemctl --user enable --now lattice-agent
systemctl --user status lattice-agent
journalctl --user -u lattice-agent -f
```

### Local cache

The dedup cache lives at `~/.local/share/lattice/agent.db` (SQLite). Delete it to force
a full re-index on next run.

### Logging

Set `RUST_LOG=lattice_agent=debug` (in the service file or environment) for verbose output.
