> BACKFILLED ARTIFACT
> Reverse-engineered from `agent/src/` on 2026-05-23.
> This is NOT the original intent of the feature; it is an inferred
> description based on code inspection. Treat as documentation, not spec.

# Tasks: Local File Indexer (Agent)

All tasks represent shipped components. All marked [x].

- [x] T001 — Config loading from TOML with tilde expansion — `agent/src/config.rs`
- [x] T002 — SQLite path cache (known-path + hash dedup) — `agent/src/cache.rs`
- [x] T003 — Text extraction: plain text and PDF (pdftotext) — `agent/src/extract.rs`
- [x] T004 — Scan pass: WalkDir, MIME detection, change detection, POST to spine — `agent/src/scan.rs`
- [x] T005 — Agent status model and shared RwLock state — `agent/src/status.rs`
- [x] T006 — Status heartbeat push to spine every 120s — `agent/src/main.rs`
- [x] T007 — IPC Unix socket server (ForceReindex command) — `agent/src/ipc.rs`
- [x] T008 — IPC client for triggering reindex from lattice-capture — `agent/src/ipc_client.rs`
- [x] T009 — Main run loop: poll interval + ForceReindex channel coalescing — `agent/src/main.rs`
- [x] T010 — lattice-capture CLI binary — `agent/src/bin/lattice-capture.rs`
- [x] T011 — lattice-config CLI binary — `agent/src/bin/lattice-config.rs`
- [x] T012 — Linux system tray binary — `agent/src/bin/lattice-tray.rs`
- [x] T013 — Windows system tray binary — `agent/src/bin/lattice-tray-windows.rs`
- [x] T014 — Platform detection helpers — `agent/src/platform.rs`
- [x] T015 — Timestamp and formatting utilities — `agent/src/time.rs`, `agent/src/format.rs`
