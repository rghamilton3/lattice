> BACKFILLED ARTIFACT
> Reverse-engineered from `agent/src/` on 2026-05-23.
> This is NOT the original intent of the feature; it is an inferred
> description based on code inspection. Treat as documentation, not spec.

# Local File Indexer (Agent)

## 1. Feature Summary

The Lattice agent is a Rust daemon that runs on a user's machine, periodically walks configured
watch directories, extracts text from supported files (plain text, PDF via pdftotext), and POSTs
them to spine's `/api/agent/file` endpoint for indexing and search. It tracks previously seen
files in a local SQLite cache to skip unchanged content. It also provides a system tray icon, an
IPC socket for force-reindex commands, a heartbeat that pushes status to spine every 2 minutes,
and a companion CLI (`lattice-capture`) for one-shot text/file capture.

## 2. Target Users

Single self-hosted user who wants their local file system (notes, PDFs, text files) to appear in
Lattice search alongside web captures.

## 3. Primary User Stories

- As a user, my local files appear in Lattice search without manual import.
- As a user, new and changed files are indexed within one poll interval (default: configurable
  minutes).
- As a user, I can force an immediate re-index from the system tray or via `lattice-capture
  --reindex`.
- As a user, the agent reports its scan state (idle / scanning / error) to spine so the surface
  can show a live status indicator.
- As a user, I can capture a quick text note from the command line with `lattice-capture`.
- As a user, PDFs in my watch paths are indexed by their extracted text content.

## 4. In-Scope / Out-of-Scope

**In scope (observed):**
- Directory walking via `walkdir` respecting configurable `patterns` (glob-style filters).
- SHA-based change detection via a local SQLite cache (`cache.rs`).
- Text extraction: `text/*` MIME types (direct read), `application/pdf` (pdftotext shell command).
- MIME type detection via `mime_guess`.
- Status heartbeat to spine every 120 seconds.
- IPC Unix socket (`ipc.rs`) accepting `ForceReindex` commands; channel-based coalescing of
  multiple commands.
- System tray icon (`lattice-tray.rs`) with basic menu — Linux and Windows variants.
- `lattice-capture` CLI binary for ad-hoc text capture and file attachment posting.
- `lattice-config` CLI binary for config inspection/editing.

**Out-of-scope (not observed):**
- File system event watching (inotify/FSEvents) — polling only.
- Audio/video/image text extraction.
- Encrypted file support.
- Windows tray fully functional (`lattice-tray-windows.rs` is a separate bin, status unknown).

## 5. Non-Functional Reality

- **Auth**: `agent_token` from `config.toml` sent as bearer on all POSTs.
- **Error handling**: Per-file errors counted in scan pass; last error message stored in shared
  status; spine POST failures noted per file but scan continues.
- **Config**: TOML at `~/.config/lattice/config.toml` with tilde expansion. Machine ID defaults
  to hostname if unset.
- **Dependency**: `pdftotext` (poppler-utils) must be installed separately for PDF support;
  agent bails gracefully with an error message if absent.
- **Concurrency**: Tokio async runtime; scan is sequential per-file (not parallel); IPC and
  heartbeat are separate tasks.

## 6. Open Questions

- NEEDS-CLARIFICATION: Is filesystem-event watching (inotify) planned to replace polling?
- NEEDS-CLARIFICATION: What is the maximum file size limit (`max_file_bytes`) default and how
  is it communicated to the user?
- NEEDS-CLARIFICATION: Are there plans to support other extraction backends (e.g. Tesseract OCR
  for images)?
- NEEDS-CLARIFICATION: Is the Windows tray (`lattice-tray-windows.rs`) production-ready or a
  stub?
- NEEDS-CLARIFICATION: Does `lattice-capture` support piped stdin or only positional arguments?
