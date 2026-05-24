> BACKFILLED ARTIFACT
> Reverse-engineered from `agent/src/` on 2026-05-23.
> This is NOT the original intent of the feature; it is an inferred
> description based on code inspection. Treat as documentation, not spec.

# Plan: Local File Indexer (Agent)

## 1. Architecture As-Is

```
agent/src/main.rs          - entry point: config load, cache open, Tokio runtime
  +-- scan::run_pass()     - walk all watch entries, index changed files
  +-- scan::push_status()  - POST agent status to spine
  +-- ipc::serve()         - Unix socket IPC (receives ForceReindex)
  +-- heartbeat task       - push_status every 120s

agent/src/
  scan.rs        - WalkDir pass, mime_guess, extract_text, POST to spine
  cache.rs       - SQLite-backed known-path + hash cache to skip unchanged files
  config.rs      - TOML parse from ~/.config/lattice/config.toml with tilde expansion
  extract.rs     - extract_text(): text/* direct read, PDF via pdftotext shell command
  ipc.rs         - Unix socket server, AgentCommand enum
  ipc_client.rs  - client-side IPC for lattice-capture --reindex
  status.rs      - SharedStatus (RwLock), ScanState enum
  time.rs        - timestamp helpers
  format.rs      - output formatting helpers
  icon.rs        - tray icon asset embedding
  platform.rs    - platform detection helpers
  lib.rs         - re-exports

agent/src/bin/
  lattice-capture.rs       - CLI: capture text/file, optionally trigger reindex
  lattice-config.rs        - CLI: inspect/edit config.toml
  lattice-tray.rs          - Linux system tray (ksni or similar)
  lattice-tray-windows.rs  - Windows system tray variant
```

## 2. Data Model

Agent-local SQLite cache (cache.rs):
- Stores known paths + content hashes to detect changes between scan passes.

Spine-side schemas written by agent (POST payloads):
- `POST /api/agent/file`: `{ machine_id, path, hash, mime_type, text, modified_at, size_bytes }`
- `POST /api/agent/status`: `{ machine_id, state, last_scan_at, last_indexed, last_skipped,
  last_errors, spine_ok, last_error_msg }`

## 3. API Contracts (consumed)

- `POST /api/agent/file` - upsert file index entry
- `POST /api/agent/capture` - from `lattice-capture` CLI
- `POST /api/agent/status` - heartbeat and scan state

Auth: `Authorization: Bearer <agent_token>` on all requests.

## 4. Dependencies

- `tokio` async runtime
- `reqwest` HTTP client (30s timeout)
- `walkdir` for recursive directory traversal
- `mime_guess` for MIME type detection by extension
- `tracing` + `tracing-subscriber` for structured logging
- `anyhow` for error handling
- `pdftotext` (poppler-utils system package) for PDF extraction
- `serde` + `toml` for config parsing
- Local SQLite (via `rusqlite` or similar — NEEDS-CLARIFICATION)

## 5. Known Technical Debt

- Polling only — no inotify/FSEvents. 15-minute default interval means newly created files
  appear in search with up to 15 minutes delay.
- `pdftotext` spawned as a subprocess with no timeout; a corrupted PDF could hang a scan pass.
- Windows tray is a separate binary with unknown completion status.
- No unit tests present in `agent/src/` — all behavior verified manually or via integration.
