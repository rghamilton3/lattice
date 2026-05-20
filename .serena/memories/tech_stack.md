# tech_stack

- **Runtime / package manager / test runner**: Bun (pinned via `mise.toml` as `"latest"`; use `bun` not `npm`/`node`)
- **Language**: TypeScript; strict mode; target ES2021; `bun-types` for Bun globals
- **Web framework**: Elysia (`elysia` package, latest)
- **Validation**: TypeBox (built into Elysia) — use for all request body schemas
- **Database**: SQLite via Bun's built-in `bun:sqlite` — no external ORM or query builder
- **Migrations**: plain numbered SQL files in `migrations/`; applied at startup in filename order
- **Tool versions managed by**: mise (`mise.toml` at repo root)
- **Dev dependencies**: `bun-types` only; no tsc emit — Bun runs TypeScript natively

Future planned deps (not yet added): QMD (embedding/retrieval library) as a local dependency.
