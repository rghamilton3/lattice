# Lattice

Personal knowledge management substrate, designed around ADHD-aware constraints: capture loosely, retrieve intelligently, no required rituals.

## Components

| Directory | Language | Role |
|-----------|----------|------|
| [`spine/`](./spine) | TypeScript (Bun, Elysia) | Central server on the VPS. Owns SQLite, hosts QMD search, serves the API and surface. |
| [`agent/`](./agent) | Rust | Per-machine local file indexer. Polls watched directories, POSTs text to spine. |
| `surface/` | TypeScript (SvelteKit) | SPA workbench: search, reading panes, working docs. Served as static files by spine. *(Not yet built.)* |

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

On any Linux machine you want to index:

```bash
bash <(curl -fsSL https://raw.githubusercontent.com/rghamilton3/lattice/main/install.sh)
```

The installer prompts for your spine URL, agent token, and watch directories, then installs
`lattice-agent` and enables it as a systemd user service.

## Quickstart (spine dev)

```bash
just dev           # spine dev server (more recipes as surface lands)
just test          # all tests
```

## License

[AGPL-3.0](./LICENSE). If you run a modified version as a network service, you must publish your changes.
