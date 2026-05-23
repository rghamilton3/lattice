# spine

<img src="../surface/static/favicon.svg" width="48" alt="Lattice icon">

[![CI spine](https://github.com/rghamilton3/lattice/actions/workflows/spine-ci.yml/badge.svg)](https://github.com/rghamilton3/lattice/actions/workflows/spine-ci.yml)
[![Docker](https://github.com/rghamilton3/lattice/actions/workflows/spine-docker.yml/badge.svg)](https://github.com/rghamilton3/lattice/actions/workflows/spine-docker.yml)

Central server for [Lattice](https://github.com/rghamilton3/lattice) — a personal knowledge management system. Built with [Bun](https://bun.sh) and [Elysia](https://elysiajs.com).

Spine owns the SQLite database, serves the REST API, and runs QMD hybrid search over all captured content. It binds to `localhost` only; Caddy handles TLS and Authelia handles authentication from the outside.

## Architecture

```
lattice/
├── spine/    ← you are here (Bun/Elysia, TypeScript)
├── agent/    ← local file indexer (Rust) — POSTs to /api/agent/index
└── surface/  ← SvelteKit SPA — served as static files from /
```

### Auth

Two distinct paths:

- `/api/agent/*` — Bearer token auth (`LATTICE_AGENT_TOKEN`)
- All other routes — Authelia forward auth via `Remote-User` header injected by Caddy

### Database

SQLite via Bun's built-in `bun:sqlite`. Migrations live in `migrations/` and are applied in order on startup. Never alter tables by hand.

## Routes

| Method   | Path                                        | Auth     | Description                                                          |
| -------- | ------------------------------------------- | -------- | -------------------------------------------------------------------- |
| `GET`    | `/ping`                                     | none     | Health check — returns `{ ok: true }`                                |
| `GET`    | `/`                                         | Authelia | UI: recent captures or search results                                |
| `GET`    | `/api/captures?limit=N`                     | Authelia | Returns up to 200 recent captures                                    |
| `GET`    | `/api/search?q=<query>`                     | Authelia | QMD hybrid search (BM25 + vector + rerank)                           |
| `GET`    | `/api/captures/:id/attachments`             | Authelia | List attachments for a capture                                       |
| `POST`   | `/api/captures/:id/attachments`             | Authelia | Upload a file attachment to a capture (multipart/form-data)          |
| `GET`    | `/api/captures/:id/attachments/:attId/raw`  | Authelia | Download attachment binary (forces download via Content-Disposition) |
| `DELETE` | `/api/captures/:id/attachments/:attId`      | Authelia | Delete an attachment                                                 |
| `GET`    | `/api/working/:slug/attachments`            | Authelia | List attachments for a working doc                                   |
| `POST`   | `/api/working/:slug/attachments`            | Authelia | Upload a file attachment to a working doc (multipart/form-data)      |
| `GET`    | `/api/working/:slug/attachments/:attId/raw` | Authelia | Download attachment binary (forces download via Content-Disposition) |
| `DELETE` | `/api/working/:slug/attachments/:attId`     | Authelia | Delete an attachment                                                 |
| `POST`   | `/api/agent/capture`                        | Bearer   | Accepts `{ text, source, captured_at }` — returns `{ id }`           |
| `POST`   | `/api/agent/index`                          | Bearer   | Upserts file index entry; idempotent on `(machine_id, path, hash)`   |

## Development

```bash
cp .env.example .env       # fill in LATTICE_AGENT_TOKEN at minimum
bun install
bun run dev                # hot-reload dev server on :3000
```

`ALLOW_HTTP=true` and `DEV_USER=dev@local` are set in `.env.example` so you can hit the UI without Caddy/Authelia in front.

```bash
bun test                   # run all tests
bun test src/foo.test.ts   # run a single file
```

## Environment variables

| Variable              | Default            | Description                                                                |
| --------------------- | ------------------ | -------------------------------------------------------------------------- |
| `LATTICE_AGENT_TOKEN` | —                  | Bearer token for `/api/agent/*`. Generate with `openssl rand -base64 32`.  |
| `DATABASE_PATH`       | `./lattice.dev.db` | SQLite database path. Production: `/var/lib/lattice/lattice.db`.           |
| `ALLOW_HTTP`          | `false`            | Set `true` for local dev only. Spine fails closed on non-HTTPS by default. |
| `DEV_USER`            | —                  | Bypasses Authelia and injects this value as `Remote-User`. Local dev only. |
| `HOST`                | `127.0.0.1`        | Listen address. The Docker image overrides this to `0.0.0.0`.              |
| `SIGNAL_PHONE_NUMBER` | —                  | Your E.164 number for the Signal relay (e.g. `+15551234567`).              |
| `SIGNAL_RPC_HOST`     | `127.0.0.1:7583`   | TCP address of the signal-cli JSON-RPC daemon.                             |

## Docker

```bash
# Spine only
docker compose up -d

# Spine + Signal relay
docker compose -f docker-compose.yml -f docker-compose.relay.yml up -d
```

The image is published to `ghcr.io/rghamilton3/lattice-spine:latest` by GitHub Actions on every push to `main`.

Data is persisted to `/var/lib/lattice` on the host via a named volume mount:

| Path on host                    | Inside container     | Contents                  |
| ------------------------------- | -------------------- | ------------------------- |
| `/var/lib/lattice/lattice.db`   | `/data/lattice.db`   | SQLite database           |
| `/var/lib/lattice/attachments/` | `/data/attachments/` | Uploaded file attachments |
| `/var/lib/lattice/.cache/`      | `/data/.cache/`      | QMD embedding cache       |

The attachments directory is created automatically on first use. No extra volume configuration is required.

## lattice-capture

`lattice-capture` is a native Rust binary in the [`agent/`](../agent) crate that sends captures from any machine. It queues offline captures in a local SQLite database (`~/.local/share/lattice/queue.db`) and flushes them on the next successful run.

Installed alongside `lattice-tray` via [`install.sh`](../install.sh) or built directly:

```bash
cd ../agent
cargo build --release --bin lattice-capture
cp target/release/lattice-capture ~/.local/bin/
```

Reads spine URL and agent token from `~/.config/lattice/config.toml` (shared with `lattice-agent`).

```bash
lattice-capture "some thought"          # from a hotkey
echo "some thought" | lattice-capture   # from a pipe
lattice-capture                         # interactive — prompts via walker/wofi/rofi
```

The tray menu's **Capture…** item invokes the no-arg form.

## Signal relay

`src/signal-relay.ts` forwards Signal "notes to self" messages into spine as captures. It connects to a running [signal-cli](https://github.com/AsamK/signal-cli) JSON-RPC daemon and filters by `SIGNAL_PHONE_NUMBER`.

```bash
bun run relay              # run the relay directly
```
