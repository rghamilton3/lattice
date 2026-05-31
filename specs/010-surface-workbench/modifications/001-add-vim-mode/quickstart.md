# Quickstart: Add Vim Mode Indicator To Editor

## Prerequisites

- Install repository dependencies per the root project setup.
- Run spine and Surface together with `just dev`, or run Surface with its dev proxy while spine is available in development mode.

## Implementation Loop

1. Update the editor UI in `surface/src/components/editor/EditorPane.svelte` and/or `surface/src/components/editor/VimToggle.svelte` so the editor shows accessible Vim mode state.
2. Keep `surface/src/lib/state/workbench.svelte.ts` as the state authority unless implementation proves a minimal existing-state adjustment is required.
3. Add or update tests that verify the indicator shows off and on states and updates when toggled.
4. Update `docs/accessibility/surface-workbench.md` with evidence for text state, keyboard behavior, and bilingual N/A rationale.

## Validation

Run targeted checks from the repository root or `surface/` directory:

```bash
cd surface && bun run check
cd surface && bun run test:unit
cd surface && bun run test:e2e
```

Before merge, run project-level validation expected by the constitution:

```bash
just lint
just check
```

## Manual Smoke Test

1. Open Surface and navigate to a working document editor.
2. Confirm the editor shows Vim mode as off when the preference is disabled.
3. Toggle Vim mode from the editor control and confirm the indicator changes to on.
4. Toggle Vim mode from settings or command palette and confirm the editor indicator stays synchronized.
5. Confirm editor typing, save, delete, and existing Vim ex command behavior are unchanged.
