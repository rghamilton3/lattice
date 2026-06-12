# Tasks: Voice-Activated Quick Capture (009-mod-002)

**Workflow**: Modify (Impact-Analysis-First)
**Status**: Active
**Created**: 2026-06-11

## Phase 1: Impact Validation

- [x] T001 Review impact analysis: no breaking changes, no migration, risk 2/10. Validated against `agent/src/platform.rs`, `agent/src/bin/lattice-capture.rs`, tray launcher, and the user's Hyprland bindings.

## Phase 2: Compatibility Layer

- [x] T002 N/A: no breaking changes (additive flag; internal signature change with both call sites updated atomically).

## Phase 3: Core Implementation

- [x] T003 `agent/src/platform.rs`: add Linux-gated voxtype helpers (`record start`, `record cancel`, `status` check) with non-fatal failure + notification; extend `prompt_text(title, voice)` to start dictation on open, swap the hint line, and run the close-time cancel guard.
- [x] T004 `agent/src/bin/lattice-capture.rs`: parse `--voice` (implies `--prompt`) before treating args as capture text; update both `prompt_text` call sites and the module doc comment.

## Phase 4: Testing and Validation

- [x] T005 `cargo test` (regression: queue tests must pass unchanged) + `cargo clippy` + `cargo fmt --check` in `agent/`.
- [ ] T006 Manual validation per quickstart: voice hotkey end-to-end, Esc-mid-recording cancel guard, daemon-stopped degradation, plain `--prompt` regression.

## Phase 5: Docs and Rollout

- [x] T007 `README.md`: document `--voice` and the Hyprland binding example.
- [x] T008 User machine: add `bindd = CTRL ALT, V, Lattice Voice Capture, exec, ~/.local/bin/lattice-capture --voice` to `~/.config/hypr/bindings.conf` and reload Hyprland.

## Summary

**Total tasks**: 8 (2 pre-resolved) | **Breaking changes**: No | **Migration**: No
