# Modification Spec: Add Vim Mode Indicator To Editor

**Original Feature**: [010-surface-workbench](../../spec.md)
**Modification ID**: 010-mod-001
**Branch**: `010-mod-001-add-vim-mode`
**Created**: 2026-05-30
**Status**: Draft

## Input
User description: "add vim mode indicator to editor"

## Why Modify?

Surface already supports a persisted Vim mode preference for the workbench editor, but keyboard-oriented users need immediate editor-local feedback about whether Vim bindings are active while they are writing. A visible indicator reduces mode confusion, helps users avoid accidental text edits or command keystrokes, and makes the existing editor mode setting discoverable at the point of use.

## What's Changing?

### Added
- Add an editor-local Vim mode indicator that shows the current Vim mode state from the active workbench preference.
- Ensure the indicator updates when Vim mode is toggled from editor controls, settings, command palette actions, or keyboard shortcuts.
- Provide accessible text for the indicator so the state is not communicated by color alone.

### Modified
- Editor chrome currently exposes a Vim toggle, while global shell/status surfaces also show Vim on/off state. The editor will now include a clearer in-context indicator so users can confirm active editor mode without scanning the application shell.
- Existing Vim mode toggle behavior remains unchanged, but the UI should distinguish the persistent Vim preference state from the active editing experience more visibly.
- Editor accessibility evidence will need to cover the new state indicator alongside existing keyboard and settings behavior.

### Removed
- None.

### Unchanged (Important to Document)
- Existing workbench preference persistence for Vim mode MUST remain compatible with the original `Workbench Session` preference shape.
- Existing settings, command palette, and shortcut mechanisms for toggling Vim mode MUST keep working.
- Existing editor save/quit Vim ex commands and CodeMirror editor behavior MUST not be removed or renamed by this modification.
- No spine API, database schema, hosted service, or authentication behavior changes are expected.

## Impact Analysis

Auto-generated impact analysis was created at `specs/010-surface-workbench/modifications/001-add-vim-mode/impact-analysis.md`.

### Files Affected (from original implementation)
**Created in Original Feature**:
- The scanner did not identify files from `specs/010-surface-workbench/tasks.md`.

**Will Need Updates**:
- `surface/src/components/editor/EditorPane.svelte` - likely editor chrome location for the visible Vim mode indicator.
- `surface/src/components/editor/VimToggle.svelte` - likely existing Vim mode control whose visible state may be reused or clarified.
- `surface/e2e/surface.e2e.ts` or related Surface tests - likely coverage for visible indicator state and no keyboard regression.
- `docs/accessibility/` evidence for Surface workbench editor changes.

**Unchanged but Referenced**:
- `surface/src/lib/state/workbench.svelte.ts` - existing persisted Vim preference source should remain the state authority.
- `surface/src/components/overlays/Settings.svelte` - existing setting continues to toggle the same preference.
- `surface/src/components/overlays/CommandPalette.svelte` - existing command continues to toggle the same preference.
- `surface/src/components/shell/AppShell.svelte` - existing global Vim status can remain as supporting status text.

### Contracts Changed
**Original Contracts** (from `specs/010-surface-workbench/contracts/`):
- None expected. `surface-workbench.md` should remain valid unless planning identifies a UI contract update for editor state visibility.

**New Contracts Needed**:
- None expected. This is a client UI visibility change over existing state.

### Tests Requiring Updates
**From Original Feature** (in `specs/010-surface-workbench/tasks.md`):
- The scanner did not identify original task-linked tests.

**New Tests Needed**:
- Add or update Surface UI coverage proving the editor shows Vim mode state when enabled and disabled.
- Add or update regression coverage proving toggling Vim mode through existing entry points updates the editor indicator.
- Preserve coverage that shortcuts do not fire from text-entry/editor contexts unexpectedly.

### Database Migrations
- [x] No database changes required
- [ ] Migration needed: N/A
- [ ] Data migration needed: N/A
- [x] Backward compatible: Yes

### Dependencies Changed
**New Dependencies**:
- None expected.

**Updated Dependencies**:
- None expected.

**Removed Dependencies**:
- None expected.

## Backward Compatibility

**Breaking Changes**: [ ] Yes | [x] No

This modification should be backward compatible because it only adds visible editor state for an existing persisted Vim mode preference. Existing stored preferences remain readable, no API contracts change, and users who do not use Vim mode should see the disabled state without needing migration.

**Compatibility Checklist**:
- [x] Existing API contracts unchanged OR properly versioned
- [x] Existing data readable by new code
- [ ] Existing tests pass after modification
- [x] No forced migration for existing users
- [x] Deprecation warnings added if removing functionality (N/A; no removal planned)

## Updated User Scenarios
*Filled during /speckit.plan - Only scenarios that change, reference original spec for unchanged*

### Modified Scenario: Operate With Keyboard And Low-Friction Controls
**Original**: Users can use command palette, quick capture, settings, new document, focus mode, and triage shortcuts without conflicts.
**Modified**: **Given** an editor is open, **When** Vim mode is enabled or disabled, **Then** the editor visibly and accessibly indicates the current Vim mode state.
**Why Changed**: The existing keyboard workflow needs local feedback where editing occurs.

### New Scenario: Confirm Editor Vim Mode State
**Given** a user is editing a working document, **When** they look at the editor controls or toggle Vim mode, **Then** they can determine whether Vim mode is active without relying on color alone or leaving the editor context.
**Why Added**: Prevents mode confusion for keyboard-oriented editing.

### Removed Scenario: None
**Was**: N/A
**Why Removed**: No user scenario is being removed.
**Migration**: N/A

## Updated Requirements
*Filled during /speckit.plan*

### Modified Requirements
- **Original FR-008**: Surface MUST provide a settings surface for theme, density, reading font, notification posture, and editor mode with visible labels and persisted selections.
  - **Modified to**: Planning should decide whether editor-local mode visibility is added to FR-008 or captured as a new requirement.
  - **Justification**: The change improves editor mode visibility beyond settings.
- **Original FR-009**: Surface MUST provide keyboard shortcuts for common workbench actions while avoiding shortcut handling inside text-entry targets, editors, and modal flows that own the keyboard.
  - **Modified to**: Planning should include indicator behavior when Vim mode is toggled through shortcut-capable paths.
  - **Justification**: Indicator state must stay synchronized with keyboard-driven mode changes.

### New Requirements
- **FR-NEW-001**: Surface MUST show a visible and accessible Vim mode state indicator in the editor when the editor is rendered.
- **FR-NEW-002**: The editor Vim mode indicator MUST update when Vim mode changes through any existing supported toggle path.

### Deprecated Requirements
- None.

## Constitution Compliance
*Check if modification violates any project principles*

- [x] **Specification-First**: Modification spec complete before coding
- [x] **Minimal Complexity**: No unnecessary features added beyond requirement
- [ ] **TDD**: Tests updated/added before implementation
- [x] **Progressive Enhancement**: Builds on stable foundation
- [x] **Clear Boundaries**: Maintains separation of concerns

**Violations and Justifications**:
No known violations. TDD remains pending for the planning and implementation phases.

## Testing Strategy
*Filled during /speckit.plan*

### Existing Tests
- [ ] Run full original feature test suite
- [ ] Document which tests fail (expected)
- [ ] Update failing tests to match new behavior
- [ ] Ensure all tests pass before claiming complete

### New Tests
- [ ] UI or e2e coverage for indicator visible state when Vim mode is off.
- [ ] UI or e2e coverage for indicator visible state when Vim mode is on.
- [ ] Regression coverage that settings, command palette, and editor toggle paths keep indicator state synchronized.
- [ ] Accessibility evidence that the indicator has accessible text and does not rely on color alone.

## Rollout Strategy
*Filled during /speckit.plan*

**Phased Rollout**: [ ] Yes | [x] No

If Yes:
1. **Phase 1**: N/A
2. **Phase 2**: N/A
3. **Phase 3**: N/A

**Feature Flags**: [ ] Yes | [x] No
- No feature flag expected for an additive editor visibility improvement.

**Monitoring**:
- Watch Surface automated checks for editor/workbench regressions.
- Watch accessibility evidence updates for keyboard and visible text coverage.

**Rollback Plan**:
Remove the editor-local indicator UI while preserving existing Vim toggle state, settings, command palette action, and persisted preference handling.

---

## Verification Checklist

- [x] Impact analysis reviewed and accurate
- [x] Backward compatibility assessed
- [x] Migration path documented (if breaking; N/A because no breaking changes expected)
- [x] All modified scenarios documented
- [x] Tests strategy defined
- [x] Rollout plan complete
- [x] Original spec cross-referenced
- [x] Constitution compliance verified

---
*Modification spec created using `/modify` workflow - See .specify/extensions/workflows/modify/*
