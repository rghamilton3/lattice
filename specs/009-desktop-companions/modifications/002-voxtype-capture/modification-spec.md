# Modification Spec: Voice-Activated Quick Capture (voxtype)

**Original Feature**: [009-desktop-companions](../../spec.md)
**Modification ID**: 009-mod-002
**Branch**: `worktree-feat+voxtype-capture`
**Created**: 2026-06-11
**Status**: Active
**Impact Analysis**: [impact-analysis.md](impact-analysis.md)

## Input

User description: "desktop capture on Linux should have a mode that toggles
voxtype on so I can hit something like `<key_a>+<key_b>` to open the desktop
capture prompt with voxtype activated, instead of the current scenario where I
have to `<key_a>+<key_c>` THEN `<key_a>+<key_d>`."

Concretely on this machine: `CTRL+ALT+C` (open prompt) followed by `SUPER+H`
(`voxtype record toggle`) should collapse into one chord.

## Why Modify?

Voice capture is the fastest way to get a thought into Lattice, but requiring
two hotkey chords in strict order adds friction and failure modes (forgetting
the second chord and talking to a non-recording window). A single chord that
opens the prompt with dictation already live makes voice the path of least
resistance.

## What's Changing?

### Added

- **F001: `--voice` CLI flag** on `lattice-capture`. Implies `--prompt`.
  Starts a voxtype recording (`voxtype record start`) as the prompt window
  opens. The user speaks, presses their existing voxtype stop/toggle key, and
  the transcript is typed into the focused prompt; `Ctrl+Enter` submits.
- **F002: Close-time dictation guard.** When the prompt closes (submit, Esc,
  or window close) and voxtype is still `recording`/`transcribing`, run
  `voxtype record cancel` so a pending transcript is never typed into
  whichever window gains focus next.
- **F003: Graceful degradation.** If voxtype is not installed, the daemon is
  not running, or the platform is not Linux, show a normal-urgency
  notification and continue as a plain text prompt. A voice-mode failure must
  never block a text capture.
- **F004: Voice-mode hint text.** The prompt's hint line tells the user to
  speak and use their voxtype stop key, alongside the existing
  `Ctrl+Enter`/`Esc` hints (text-only, per A11Y-001).
- Deployment (user machine, outside repo): Hyprland binding
  `bindd = CTRL ALT, V, Lattice Voice Capture, exec, ~/.local/bin/lattice-capture --voice`

### Modified

- `platform::prompt_text(title)` → `prompt_text(title, voice)`.
  **Was**: opens the eframe prompt. **Now**: optionally starts/cleans up a
  voxtype recording around the same window. **Why**: the window lifecycle is
  the only place that knows when dictation should start and when a pending
  transcript becomes dangerous.
- `lattice-capture` argument handling. **Was**: any non-`--prompt` args are
  joined as capture text. **Now**: known flags (`--prompt`, `--voice`) are
  parsed first and never leak into capture text. **Why**: `--voice` as literal
  capture text would be a silent misfire.

### Removed

- Nothing. The two-chord flow keeps working: `--prompt` alone never touches
  voxtype, and `SUPER+H` remains an independent user binding.

### Unchanged (Important to Document)

- Capture payload, `source: "desktop-hotkey"` label, spine route, bearer-token
  auth, offline queue schema and drain behavior (FR-001..FR-004).
- Tray menu launches `lattice-capture --prompt` (text mode) as before.
- Windows/macOS builds: flag accepted, degrades per F003; voxtype shell-outs
  are compile-gated like `platform::notify()`.
- voxtype's own configuration, model, and stop/toggle keybinding remain
  entirely the user's (this feature only starts/cancels recordings).

## Success Metrics

| Metric | Target | Measurement |
|--------|--------|-------------|
| Chords to start a voice capture | 1 (was 2) | Manual |
| Text-mode regression | Zero behavior change without `--voice` | `cargo test` + manual `--prompt` |
| Stray transcripts after close | Zero | Manual: Esc mid-recording, then focus another window |

## Alternative Approaches Considered

- **Hyprland-side compound binding** (`exec` both commands with a sleep):
  rejected; racy (no window-focus guarantee at stop time), no cleanup on
  cancel, logic lives outside the product.
- **Tray-owned global hotkey**: rejected; Wayland global shortcuts belong to
  the compositor, and the existing pattern (compositor binds → CLI) works.
- **`voxtype record toggle` instead of `start`**: rejected; if a recording is
  somehow already live, `start` is idempotent-ish in intent while `toggle`
  would stop it and type into the wrong window.

## Tech Stack Compliance

No new crates. `std::process::Command` shell-out to an optional external tool,
non-fatal on absence, cfg-gated to Linux. Matches existing platform.rs
patterns.

## Metadata

**Workflow**: Modify (Impact-Analysis-First)
**Created By**: SpecSwarm /ss:modify
