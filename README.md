# Lattice

<img src="./surface/static/favicon.svg" width="48" alt="Lattice icon">

[![CI lattice-agent](https://github.com/rghamilton3/lattice/actions/workflows/agent-ci.yml/badge.svg)](https://github.com/rghamilton3/lattice/actions/workflows/agent-ci.yml)
[![CI spine](https://github.com/rghamilton3/lattice/actions/workflows/spine-ci.yml/badge.svg)](https://github.com/rghamilton3/lattice/actions/workflows/spine-ci.yml)
[![CI surface](https://github.com/rghamilton3/lattice/actions/workflows/surface-ci.yml/badge.svg)](https://github.com/rghamilton3/lattice/actions/workflows/surface-ci.yml)
[![CI quality](https://github.com/rghamilton3/lattice/actions/workflows/ci-quality.yml/badge.svg)](https://github.com/rghamilton3/lattice/actions/workflows/ci-quality.yml)
[![Docker](https://github.com/rghamilton3/lattice/actions/workflows/spine-docker.yml/badge.svg)](https://github.com/rghamilton3/lattice/actions/workflows/spine-docker.yml)

Personal knowledge management substrate, designed around ADHD-aware constraints: capture loosely, retrieve intelligently, no required rituals.

## Components

| Directory               | Language                 | Role                                                                                                   |
| ----------------------- | ------------------------ | ------------------------------------------------------------------------------------------------------ |
| [`spine/`](./spine)     | TypeScript (Bun, Elysia) | Central server on the VPS. Owns SQLite, hosts QMD search, serves the API and surface.                  |
| [`agent/`](./agent)     | Rust                     | Per-machine local file indexer. Polls watched directories, POSTs text to spine.                        |
| [`surface/`](./surface) | TypeScript (SvelteKit)   | SPA workbench: search, reading panes, working docs, file attachments. Served as static files by spine. |

See [`plan.md`](./plan.md) for the full architecture and phased build plan.

## Signal Relay

The relay bridges Signal Note-to-Self messages to the spine. It runs as a Docker container alongside signal-cli and posts accepted messages to `/api/agent/capture` with source `signal`.

The relay only captures messages from your configured Signal number to the same number. Normal conversations, group messages, malformed frames, and empty messages are skipped.

```bash
cd spine
docker compose -f docker-compose.relay.yml up -d
```

**Environment variables** (set in `spine/.env` or injected via your environment):

| Variable                 | Description                                                                                                                                                                                                                                               |
| ------------------------ | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `LATTICE_AGENT_TOKEN`    | Bearer token for `/api/agent/*` routes                                                                                                                                                                                                                    |
| `SIGNAL_PHONE_NUMBER`    | Your Signal number in E.164 format (e.g. `+15551234567`)                                                                                                                                                                                                  |
| `SIGNAL_RPC_HOST`        | Signal JSON-RPC host and port. Defaults to `127.0.0.1:7583` when omitted.                                                                                                                                                                                 |
| `SPINE_URL`              | Capture endpoint. Defaults to `http://127.0.0.1:3000/api/agent/capture` for same-host deployments.                                                                                                                                                        |
| `SIGNAL_ATTACHMENTS_DIR` | Path _inside the container_ where signal-cli attachment files are readable. Set to `/signal-cli-attachments` and bind-mount your signal-cli attachments directory to that path in `docker-compose.relay.yml`. Without this, the relay captures text only. |
| `SIGNAL_RELAY_DEBUG`     | Set to `1` to log parser skip reasons while troubleshooting Signal frame shapes.                                                                                                                                                                          |

To configure voice note and file attachment storage, edit the `volumes:` block in `docker-compose.relay.yml` to point to your signal-cli attachments directory (check your signal-cli data directory, commonly `/var/lib/signal-cli/data/attachments`):

```yaml
volumes:
  - /var/lib/signal-cli/data/attachments:/signal-cli-attachments:ro
```

Relay diagnostics are printed as plain text. Startup fails fast when `LATTICE_AGENT_TOKEN` or `SIGNAL_PHONE_NUMBER` is missing; missing `SIGNAL_ATTACHMENTS_DIR` is only a warning because text capture still works.

## Install the agent

The local agent indexes files from configured watch directories. It polls each
directory, extracts supported text, skips unchanged files with a local SQLite
cache, and sends changed content to the spine with the `/api/agent/index` bearer
token route.

Supported extraction is intentionally small: `text/*` files are read directly and
PDFs use the local `pdftotext` command from poppler-utils. Other MIME types,
hidden paths, symlinks, and files over the configured size limit are skipped with
plain text diagnostics in the foreground log or systemd user journal.

Configuration lives at `~/.config/lattice/config.toml` on Linux:

```toml
[spine]
url = "https://lattice.example.com"
agent_token = "replace-me"

[agent]
machine_id = "laptop"
poll_interval_minutes = 15
max_file_bytes = 10485760

[[agent.watch]]
path = "~/Documents"
patterns = ["**/*.md", "**/*.txt", "**/*.pdf"]
```

Run `lattice-agent --force` to rebuild known watch-path state without deleting
source files. To diagnose a service install, run
`journalctl --user -u lattice-agent -f`; set `RUST_LOG=lattice_agent=debug` for
verbose scan decisions.

### Linux

On any Linux machine you want to index:

```bash
bash <(curl -fsSL https://raw.githubusercontent.com/rghamilton3/lattice/main/install.sh)
```

The installer prompts for your spine URL, agent token, and watch directories, then installs
`lattice-agent` and enables it as a systemd user service.

### Windows

In PowerShell:

```powershell
iwr https://raw.githubusercontent.com/rghamilton3/lattice/main/install.ps1 -OutFile install.ps1
.\install.ps1 -SpineUrl https://lattice.example.com -AgentToken "<token>"
```

Binaries land in `%LOCALAPPDATA%\lattice\`, the starter config in
`%APPDATA%\lattice\config.toml`. The installer registers Task Scheduler entries
that launch the agent and tray at logon.

For a global capture hotkey, either pin a shortcut to
`%LOCALAPPDATA%\lattice\lattice-capture.exe --prompt` and set its **Shortcut
key** in the Properties dialog, or, with [AutoHotkey](https://www.autohotkey.com/)
installed, add to your script:

```ahk
; AutoHotkey v2
^!l::Run('"' A_LocalAppData '\lattice\lattice-capture.exe" --prompt')
```

## Quickstart

```bash
just dev           # spine + surface dev servers together
just test          # all tests
just surface-build # build surface static files for production
```

## License

[AGPL-3.0](./LICENSE). If you run a modified version as a network service, you must publish your changes.
