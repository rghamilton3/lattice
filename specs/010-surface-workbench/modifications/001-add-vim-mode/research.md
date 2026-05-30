# Research: Add Vim Mode Indicator To Editor

## Decision: Reuse existing workbench `vimMode` as the state authority

**Rationale**: The original Surface Workbench spec already defines Vim mode as a persisted workbench preference, and `EditorPane.svelte` already reconfigures the CodeMirror Vim extension from `wb.vimMode`. Reusing this state keeps settings, command palette, keyboard shortcut, and editor control paths synchronized.

**Alternatives considered**: Add editor-local mode state; rejected because it would duplicate the persisted preference and risk divergence between settings and editor UI. Add a spine-backed preference; rejected because no API or database change is needed for a browser UI state indicator.

## Decision: Place the indicator in existing editor chrome near the Vim control

**Rationale**: `EditorPane.svelte` already renders the document name, save status, Save/Delete actions, and `VimToggle`. Adding visible mode state in this area keeps feedback in the user's editing context and avoids requiring users to scan global shell status.

**Alternatives considered**: Use only the global app shell `vim on/off` text; rejected because it is not editor-local. Overlay the indicator inside CodeMirror; rejected as higher risk because it can interfere with editor layout, selection, or accessibility semantics.

## Decision: Keep implementation dependency-free

**Rationale**: Existing Svelte, CodeMirror 6, and `@replit/codemirror-vim` dependencies already provide all behavior needed. The requirement is presentation of existing state, not new editor capabilities.

**Alternatives considered**: Add a new UI/status component library; rejected as unnecessary complexity and a constitution risk.

## Decision: Treat accessibility as part of the UI contract

**Rationale**: The original Surface Workbench accessibility requirements require visible labels, text status, keyboard coverage, and color-not-alone communication. The indicator must expose state text such as `Vim on` or `Vim off`, and any color styling must be supplemental.

**Alternatives considered**: Use only a colored dot or icon; rejected because it would violate color-not-alone requirements and be harder for screen reader users to interpret.

## Decision: Validate with targeted Surface checks and evidence update

**Rationale**: The change is isolated to editor UI and existing state. Targeted Svelte/type checks plus a unit/browser or Playwright test for toggled indicator state should catch regressions without requiring broad infrastructure changes. Accessibility evidence should document keyboard and text-status behavior.

**Alternatives considered**: Manual-only validation; rejected because original feature requires automated coverage where feasible. Full monorepo test suite only; useful before merge but too broad as the primary feedback loop for this small UI change.
