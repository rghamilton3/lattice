> BACKFILLED ARTIFACT
> Reverse-engineered from `agent/src/` on 2026-05-23.

# Gaps Report: agent

## 1. Summary Verdict

**High gap**

No automated tests at all. Polling-only design (no filesystem events) means slow update latency.
Windows tray status is unknown. `pdftotext` subprocess has no timeout. No tracking plan, no
monitoring, no ADRs.

## 2. Missing Artifacts

| Artifact | Status |
|----------|--------|
| `research/` - filesystem watcher alternatives (inotify, FSEvents, notify-rs) | Missing |
| Unit tests for `config.rs` (tilde expansion, missing fields) | Missing |
| Unit tests for `extract.rs` (text extraction, pdftotext failure modes) | Missing |
| Unit tests for `cache.rs` (hash dedup, clear logic) | Missing |
| Unit tests for `scan.rs` (WalkDir filtering, error counting) | Missing |
| Integration tests (mock spine endpoint + real filesystem) | Missing |
| ADRs: polling vs FSEvents, pdftotext vs native PDF crate | Missing |
| Tracking plan (files indexed/hour, error rate, PDF extraction success rate) | Missing |
| pdftotext subprocess timeout | Missing (observed gap — corrupted PDF could hang scan) |
| Windows tray production readiness assessment | Unknown |
| Feature flag / config option for inotify-based watching | Missing |
| Release-readiness checklist | Missing |

## 3. Inferred vs Observed

| Claim | Source | Confidence |
|-------|--------|------------|
| SHA-based change detection avoids re-uploading unchanged files | cache.rs comment + clear_known_paths on --force | HIGH |
| Poll interval default configurable via TOML | config.rs + default_poll_interval | HIGH |
| IPC coalesces multiple ForceReindex commands | `try_recv()` drain loop in main.rs | HIGH |
| pdftotext must be installed separately | Explicit bail! error message in extract.rs | HIGH |
| Heartbeat every 120s keeps surface status indicator alive between 15m scans | Comment in main.rs | HIGH |
| Windows tray is a separate binary (may be incomplete) | Separate bin file, no cross-reference | MEDIUM |
| max_file_bytes has a default value | `default_max_file_bytes` fn in config.rs | HIGH - value not read in scan |
| Agent skips files above max_file_bytes | NEEDS-CLARIFICATION — default fn present but skip logic not confirmed | LOW |
| `lattice-config` enables editing config.toml from CLI | Binary name and config module | MEDIUM |

## 4. Recommended Next Actions

1. **Add unit tests** for `config.rs`, `extract.rs`, and `cache.rs` — these are the most
   testable modules and have no coverage.

2. **Add pdftotext timeout** to `extract.rs` — use `Command` with `tokio::time::timeout` or
   `std::process::Command` with a thread + kill after N seconds.

3. **Evaluate `notify-rs`** for filesystem event watching to reduce index latency from 15m to
   near-instant. File a research task.

4. **Verify Windows tray status** — document whether `lattice-tray-windows.rs` is production-ready
   or a stub. If stub, mark it as such in README.

5. **Run tracking plan** to instrument files-indexed and error-rate metrics.

6. **Confirm `max_file_bytes` enforcement** is wired into `scan.rs` (the config field is present
   but the skip path needs verification).
