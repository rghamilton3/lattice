# Research: Config UI Watch Path File Picker

## Decision: Use native folder selection for watch paths

**Rationale**: Watch entries represent directories to index, so folder selection matches the existing `[[agent.watch]] path` use case better than selecting a single file. A folder picker reduces path typos while still allowing advanced users to type paths manually.

**Alternatives considered**: A file-only picker would not match directory watching. Text-only input is the current problem. A custom tree browser would add more UI code than this local enhancement needs.

## Decision: Keep manual path editing as the fallback and correction path

**Rationale**: Manual editing preserves existing behavior, supports paths the native picker cannot express conveniently, and provides an accessibility fallback if the platform dialog is unavailable or not keyboard-friendly in a given environment.

**Alternatives considered**: Replacing the text field entirely would risk regressions for quoted, tilde, UNC, or manually curated paths and would remove a safe fallback for unsupported dialog environments.

## Decision: Update the existing watch row path state directly after successful picker selection

**Rationale**: The selected path should flow through the same save and validation path as typed text. This avoids a second source of truth and keeps `config_edit.rs` responsible for preserving comments, validating required values, and writing TOML atomically.

**Alternatives considered**: Saving immediately from the picker would bypass existing save/cancel semantics. Storing picker-only pending state would add unnecessary synchronization logic.

## Decision: Cancel and failure preserve the prior path

**Rationale**: Opening a picker is exploratory. Canceling or failing to open the dialog must not clear or partially rewrite a watch path, because accidental removal could stop indexing user directories.

**Alternatives considered**: Clearing the field on cancel is destructive. Treating cancel as a validation error would be noisy and would punish normal dialog behavior.

## Decision: Prefer a small optional Rust GUI dependency only if required

**Rationale**: The current GUI stack uses optional `eframe`, which provides the app shell but no native cross-platform folder picker in the existing dependency set. If implementation confirms this, add a small local dialog crate such as `rfd` under the existing `gui` feature so non-GUI agent/tray builds remain unaffected.

**Alternatives considered**: Platform command invocation (`zenity`, `kdialog`, PowerShell, shell COM snippets) would add runtime tool assumptions and harder failure modes. A fully custom file browser would be larger than the feature. Keeping dependencies unchanged is preferred if an already-approved picker API exists.

## Decision: Validation remains in existing config edit/save logic

**Rationale**: Picker output is still just a path string in the existing config model. Reusing the current validation preserves behavior for blank paths, duplicate watch rows, quote/backslash handling, missing sections, invalid TOML, and comment preservation.

**Alternatives considered**: Adding picker-specific validation would duplicate rules and could diverge from manual editing behavior.

## Decision: Accessibility evidence must cover the picker control and fallback

**Rationale**: The picker is a new user-facing control. Evidence must show that it has a text label, keyboard/focus behavior where supported by the GUI toolkit/platform dialog, and clear text behavior for cancel/failure/unsupported states.

**Alternatives considered**: Treating the native dialog as outside scope misses the new interaction path. Deferring evidence would violate the feature's accessibility requirements.

## Decision: Bilingual delivery remains N/A

**Rationale**: This modification adds English local companion UI copy and no translation framework. The original Desktop Companions plan already records bilingual delivery as N/A.

**Alternatives considered**: Adding localization infrastructure for one local button label would be speculative and outside scope.

## Decision: CLI accessibility checks are conditional

**Rationale**: No terminal output is planned for the picker itself. If implementation adds terminal diagnostics for dialog launch failure, those messages must be plain text and not color-only.

**Alternatives considered**: Adding CLI checks unconditionally would be busywork if no user-facing terminal output changes.
