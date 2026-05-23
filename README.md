# Lattice

<img src="./surface/static/favicon.svg" width="48" alt="Lattice icon">

[![CI lattice-agent](https://github.com/rghamilton3/lattice/actions/workflows/agent-ci.yml/badge.svg)](https://github.com/rghamilton3/lattice/actions/workflows/agent-ci.yml)
[![CI spine](https://github.com/rghamilton3/lattice/actions/workflows/spine-ci.yml/badge.svg)](https://github.com/rghamilton3/lattice/actions/workflows/spine-ci.yml)
[![CI surface](https://github.com/rghamilton3/lattice/actions/workflows/surface-ci.yml/badge.svg)](https://github.com/rghamilton3/lattice/actions/workflows/surface-ci.yml)
[![CI quality](https://github.com/rghamilton3/lattice/actions/workflows/ci-quality.yml/badge.svg)](https://github.com/rghamilton3/lattice/actions/workflows/ci-quality.yml)
[![Docker](https://github.com/rghamilton3/lattice/actions/workflows/spine-docker.yml/badge.svg)](https://github.com/rghamilton3/lattice/actions/workflows/spine-docker.yml)

Personal knowledge management substrate, designed around ADHD-aware constraints: capture loosely, retrieve intelligently, no required rituals.

## Components

| Directory | Language | Role |
|-----------|----------|------|
| [`spine/`](./spine) | TypeScript (Bun, Elysia) | Central server on the VPS. Owns SQLite, hosts QMD search, serves the API and surface. |
| [`agent/`](./agent) | Rust | Per-machine local file indexer. Polls watched directories, POSTs text to spine. |
| [`surface/`](./surface) | TypeScript (SvelteKit) | SPA workbench: search, reading panes, working docs, file attachments. Served as static files by spine. |

See [`plan.md`](./plan.md) for the full architecture and phased build plan.

## Signal relay

The relay bridges Signal messages to the spine. It runs as a Docker container alongside signal-cli.

```bash
cd spine
docker compose -f docker-compose.relay.yml up -d
```

**Required env vars** (set in `spine/.env` or injected via your environment):

| Variable | Description |
|---|---|
| `LATTICE_AGENT_TOKEN` | Bearer token for `/api/agent/*` routes |
| `SIGNAL_PHONE_NUMBER` | Your Signal number in E.164 format (e.g. `+15551234567`) |
| `SIGNAL_ATTACHMENTS_DIR` | **Required for voice notes and file attachments.** Path *inside the container* where signal-cli attachment files are readable. Set to `/signal-cli-attachments` and bind-mount your signal-cli attachments directory to that path in `docker-compose.relay.yml`. Without this, the relay captures text only. |

To configure attachment storage, edit the `volumes:` block in `docker-compose.relay.yml` to point to your signal-cli attachments directory (check your signal-cli data directory — commonly `/var/lib/signal-cli/data/attachments`):

```yaml
volumes:
  - /var/lib/signal-cli/data/attachments:/signal-cli-attachments:ro
```

## Install the agent

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
