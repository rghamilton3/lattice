# Quickstart: Agent Indexer

## Configure

Create or update the local Lattice config file.

```toml
[spine]
url = "https://lattice.example.com"
agent_token = "replace-me"

[agent]
machine_id = "personal-laptop"
poll_interval_minutes = 15
max_file_bytes = 10485760

[[agent.watch]]
path = "~/Documents/notes"
patterns = ["**/*.md", "**/*.txt", "**/*.pdf"]
```

## Run A Foreground Scan Loop

```bash
cd agent
cargo run --bin lattice-agent
```

Force a full reindex of configured watch paths:

```bash
cd agent
cargo run --bin lattice-agent -- --force
```

## Install As A User Service

Copy the built binary to `~/.local/bin/lattice-agent`, install `agent/lattice-agent.service` as a user service, then enable it:

```bash
systemctl --user enable --now lattice-agent.service
journalctl --user -u lattice-agent.service -f
```

## Verify Spine Ingestion

Run the spine agent route tests:

```bash
cd spine
bun test tests/routes/agent.test.ts
```

Run the Rust tests:

```bash
cd agent
cargo test
```

## Accessibility Notes

Diagnostics are plain text in stdout/stderr or the systemd journal. They should remain concise, color-independent, and specific enough to identify missing config, unreadable files, extraction failures, and spine rejection causes.
