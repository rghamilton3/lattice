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

## Install

```bash
curl -fsSL https://raw.githubusercontent.com/rghamilton3/lattice/main/install.sh | bash
```

The script detects your architecture (x86\_64 or aarch64), downloads the latest release binary,
optionally installs `lattice-capture`, writes `~/.config/lattice/config.toml`, and enables the
systemd user service. Requires `curl` and `jq`.

**Optional runtime dependency:** `pdftotext` (poppler-utils) for PDF indexing.
On Arch: `sudo pacman -S poppler`. Without it, PDF files are skipped with an error log line.

### Manual setup (development)

```bash
cargo build --release
cp target/release/lattice-agent ~/.local/bin/
mkdir -p ~/.config/systemd/user
cp lattice-agent.service ~/.config/systemd/user/
systemctl --user daemon-reload
systemctl --user enable --now lattice-agent
```

### Local cache

The dedup cache lives at `~/.local/share/lattice/agent.db` (SQLite). Delete it to force
a full re-index on next run.

### Logging

Set `RUST_LOG=lattice_agent=debug` (in the service file or environment) for verbose output.
