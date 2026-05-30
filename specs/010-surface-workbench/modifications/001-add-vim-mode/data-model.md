# Data Model: Add Vim Mode Indicator To Editor

## Entity: Workbench Vim Preference

**Description**: Existing persisted user preference that determines whether CodeMirror Vim bindings are active in the Surface editor.

**Fields**:
- `vimMode`: boolean. `true` means Vim bindings are enabled; `false` means default editor keybindings are active.

**Relationships**:
- Belongs to the broader Workbench Session preference set from `specs/010-surface-workbench/spec.md`.
- Read by `EditorPane.svelte` to configure the CodeMirror Vim extension.
- Toggled by editor controls, settings, command palette, and keyboard shortcut paths.

**Validation Rules**:
- Only boolean values are valid.
- Corrupted or invalid persisted values must continue to be ignored safely by existing workbench preference validation.

**State Transitions**:
- `false -> true`: Vim mode is enabled; editor indicator must show the enabled state and CodeMirror Vim extension must remain configured.
- `true -> false`: Vim mode is disabled; editor indicator must show the disabled state and CodeMirror Vim extension must be removed via existing compartment reconfiguration.

## Entity: Editor Vim Mode Indicator

**Description**: Visible, accessible editor-local presentation of `Workbench Vim Preference` state.

**Fields**:
- `label`: text exposed visually and accessibly, such as `Vim on` or `Vim off`.
- `active`: boolean derived from `vimMode`.
- `location`: editor toolbar/chrome associated with the rendered working document editor.

**Relationships**:
- Derives state from `Workbench Vim Preference`; it must not own independent state.
- May be rendered by reusing or extending `VimToggle.svelte`.
- Appears within `EditorPane.svelte` when an editor pane is rendered.

**Validation Rules**:
- Must not rely on color alone; visible text or equivalent accessible state text is required.
- Must remain synchronized after every supported Vim toggle path.
- Must not change the working document content, slug, save status, or pane routing state.

**State Transitions**:
- `active=false`: display disabled state and preserve toggle availability.
- `active=true`: display enabled state and preserve toggle availability.

## Entity: Accessibility Evidence Entry

**Description**: Documentation proving the Surface editor indicator meets keyboard, label, and color-not-alone requirements.

**Fields**:
- `scope`: editor Vim mode indicator and existing toggle paths.
- `keyboardEvidence`: confirmation that editor-owned keys and global shortcuts remain non-conflicting.
- `statusEvidence`: confirmation that the indicator exposes text state.
- `languageDecision`: unchanged English-only/N/A bilingual rationale.

**Relationships**:
- Updates `docs/accessibility/surface-workbench.md`.

**Validation Rules**:
- Must be updated before the modification is marked complete.
