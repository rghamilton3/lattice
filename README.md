# Lattice

Personal knowledge management substrate, designed around ADHD-aware constraints: capture loosely, retrieve intelligently, no required rituals.

## Components

| Directory | Language | Role |
|-----------|----------|------|
| [`spine/`](./spine) | TypeScript (Bun, Elysia) | Central server on the VPS. Owns SQLite, hosts QMD search, serves the API and surface. |
| `agent/` | Rust | Per-machine local file indexer. Polls watched directories, POSTs text to spine. *(Not yet built.)* |
| `surface/` | TypeScript (SvelteKit) | SPA workbench: search, reading panes, working docs. Served as static files by spine. *(Not yet built.)* |

See [`plan.md`](./plan.md) for the full architecture and phased build plan.

## Quickstart

```bash
just dev           # spine dev server (more recipes as agent/surface land)
just test          # all tests
```

## License

[AGPL-3.0](./LICENSE). If you run a modified version as a network service, you must publish your changes.
