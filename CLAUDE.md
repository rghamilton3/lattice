# Lattice

Lattice is a self-hosted personal knowledge management system. It captures text and files from multiple surfaces
(browser extension, Signal, tray app), indexes local files, and exposes a searchable working-doc editor.

## Components

| Directory  | Language                  | Role                                                                |
| ---------- | ------------------------- | ------------------------------------------------------------------- |
| `spine/`   | TypeScript / Bun / Elysia | Central server: REST API, SQLite DB, serves surface as static files |
| `surface/` | SvelteKit / Tailwind      | Browser SPA: inbox, tasks, search, working doc editor               |
| `agent/`   | Rust                      | Local file indexer: watches directories, POSTs to spine             |

Each component has its own `CLAUDE.md` with detailed commands and architecture.

## Monorepo commands (Justfile)

```bash
just dev           # run spine + surface dev servers together (Ctrl+C stops both)
just spine         # run spine dev server only
just surface       # run surface dev server only
just test          # run all spine tests
just lint          # clippy + oxlint + eslint across all components
just fmt           # format all components (cargo fmt + prettier)
just check         # tsc --noEmit for all TypeScript components
just surface-build # build surface static files (output: surface/build/)
just docker-build  # build spine Docker image (includes surface)
just up            # bring up spine via docker compose
just down          # tear down docker compose
just install       # install all dependencies + git hooks (run once after clone)
```

## Where to make changes

- API routes, DB schema, search: `spine/`
- UI, SPA views, client state: `surface/`
- Local file indexing, system tray, IPC: `agent/`
- Cross-component config: `config.toml.example` (deployed to `~/.config/lattice/config.toml`)

<!-- SPECKIT START -->

For additional context about technologies to be used, project structure,
shell commands, and other important information, read the current plan:
`specs/014-doc-preview-pane/plan.md`
<!-- SPECKIT END -->
