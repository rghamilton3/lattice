# Lattice

Personal knowledge management substrate, designed around ADHD-aware constraints: capture loosely, retrieve intelligently, no required rituals.

## Components

| Directory | Language | Role |
|-----------|----------|------|
| [`spine/`](./spine) | TypeScript (Bun, Elysia) | Central server on the VPS. Owns SQLite, hosts QMD search, serves the API and surface. |
| [`agent/`](./agent) | Rust | Per-machine local file indexer. Polls watched directories, POSTs text to spine. |
| `surface/` | TypeScript (SvelteKit) | SPA workbench: search, reading panes, working docs. Served as static files by spine. *(Not yet built.)* |

See [`plan.md`](./plan.md) for the full architecture and phased build plan.

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
