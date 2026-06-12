# Impact Analysis: Voice-Activated Quick Capture (voxtype)

**Feature**: 009-desktop-companions
**Modification ID**: 009-mod-002
**Modification**: Single-hotkey capture prompt with voxtype dictation pre-activated
**Analysis Date**: 2026-06-11
**Branch**: `worktree-feat+voxtype-capture`

---

## Proposed Changes

Today a voice capture on Linux takes two hotkey chords in sequence:

1. `CTRL+ALT+C` runs `lattice-capture --prompt` (opens the eframe prompt window)
2. `SUPER+H` runs `voxtype record toggle` (starts dictation; voxtype types the
   transcript into the focused window when recording stops)

This modification adds a `--voice` flag to `lattice-capture` that starts a
voxtype recording as the prompt window opens, so one hotkey (proposed:
`CTRL+ALT+V`) replaces the two-chord dance. Stopping the recording (the user's
existing voxtype toggle key) inserts the transcript into the focused prompt;
`Ctrl+Enter` submits as usual.

**Change categories**:
- Functional: new `--voice` CLI flag on `lattice-capture` (implies `--prompt`)
- Functional: `platform::prompt_text()` gains a voice mode that shells out to
  `voxtype record start` on open and `voxtype record cancel` on close if a
  recording/transcription is still pending
- UI: prompt hint text changes in voice mode
- Deployment: one new Hyprland binding on the user's machine (outside repo)
- No API/contract changes, no data model changes

---

## Affected Components

### Direct Dependencies

| Component | Type | Impact Level | Notes |
|-----------|------|--------------|-------|
| `agent/src/bin/lattice-capture.rs` | CLI binary | Medium | Flag parsing in `read_text()`; must not swallow `--voice` as literal capture text |
| `agent/src/platform.rs` | Library | Medium | `prompt_text()` signature gains a `voice: bool` parameter; voxtype helpers added (Linux-gated) |
| `agent/src/bin/lattice-tray.rs` | Tray binary | None | Launches `lattice-capture --prompt` unchanged; does not call `prompt_text` directly |
| `README.md` | Docs | Low | Document `--voice` and example Hyprland binding |

**Total direct dependencies**: 2 code files, 1 doc

### Indirect Dependencies

| Component | Type | Impact Level | Notes |
|-----------|------|--------------|-------|
| voxtype daemon | External tool | Low | Controlled via documented `voxtype record start/cancel` + `voxtype status` CLI (signals SIGUSR1/SIGUSR2 under the hood) |
| spine `POST /api/agent/capture` | API | None | Payload and `source: "desktop-hotkey"` label unchanged |
| Offline queue (`queue.db`) | Storage | None | Schema and behavior unchanged |
| Windows/macOS builds | Platform | Low | `--voice` accepted but degrades to a notification (voxtype is Linux-only); voxtype shell-outs compile-gated like `notify()` |

---

## Breaking Changes Assessment

### Breaking changes identified: No

- `prompt_text(title)` → `prompt_text(title, voice)` is an internal library
  signature change within the same crate; both call sites are updated in the
  same commit. No external consumers exist.
- All existing invocations (`--prompt`, args-as-text, stdin pipe, tray menu)
  behave identically when `--voice` is absent.
- Capture payload, source label, queue schema, and spine contract unchanged.

---

## Backward Compatibility Strategy

**Approach**: Pure additive flag with graceful degradation.

- Without `--voice`: behavior is byte-for-byte the current behavior.
- With `--voice` but voxtype missing/daemon not running: warn via desktop
  notification and continue as a plain text prompt (capture still works).
- With `--voice` on Windows/macOS: notification states voice capture is
  Linux-only; plain prompt proceeds.

No compatibility layer, migration, or deprecation needed.

---

## Risk Assessment

### Risk level: Low

| Risk | Likelihood | Impact | Mitigation |
|------|------------|--------|------------|
| Stray transcript typed into the wrong window if the prompt closes while voxtype is still recording/transcribing | Medium | Medium | On prompt close, check `voxtype status`; if not `idle`, run `voxtype record cancel` (best-effort) |
| `--voice` passed without `--prompt` gets joined into capture text | High (if unhandled) | Low | Parse flags before treating args as text; `--voice` implies `--prompt` |
| voxtype daemon not running at hotkey time | Medium | Low | Non-fatal: notify and fall back to plain prompt |
| Recording starts a beat before the window paints | High | None | Harmless: voxtype only types on stop, by which time the prompt holds focus |

**Overall risk score**: 2/10

---

## Testing Requirements

- Unit: flag parsing (`--voice` implies prompt; flags never leak into capture
  text; arg/stdin paths unchanged). The GUI window itself remains manually
  validated, consistent with the original feature.
- Regression: existing `lattice-capture` queue tests must pass unchanged
  (`cargo test`), plus `cargo clippy` clean.
- Manual (quickstart): hotkey opens prompt recording; voxtype stop key inserts
  transcript; Esc during recording cancels without stray typing; `--voice`
  with daemon stopped degrades to plain prompt with a notification.

---

## Rollout Strategy

**Approach**: Big bang (single user, self-hosted, additive flag).

Rollback: remove the Hyprland binding; the flag is inert if unused. Reverting
the commit restores the previous binary with no data implications.

---

## Recommendations

1. Proceed: additive, low-risk, two-file change.
2. Bind `CTRL+ALT+V` (verified free in user + omarchy default Hyprland
   bindings; mirrors `CTRL+ALT+C` for text capture).
3. Always run the close-time `voxtype status`/`cancel` guard: it is the only
   defense against transcripts landing in the wrong window.

**Proceed with modification**: Yes

---

## Tech Stack Compliance

No new dependencies. voxtype is invoked via `std::process::Command` (matching
the existing shell-out-free policy exception pattern: it is an optional
external tool, absence is non-fatal). Compile gates mirror the existing
`notify()` cfg pattern (`all(unix, not(target_os = "macos"))`).

---

## Metadata

**Workflow**: Modify (Impact-Analysis-First)
**Created By**: SpecSwarm /ss:modify
