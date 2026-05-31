# Quickstart: Back Button Navigation

## Prerequisites

- Run from repository root unless a command explicitly changes to `surface/`.
- Start with the active feature pointer in `.specify/feature.json` set to `specs/014-back-button-navigation`.

## Suggested Implementation Path

1. Locate the rendered `<- back` control in `surface/src/components/**` and confirm whether it is wired through `AppShell.svelte`, `WorkbenchShell.svelte`, or a more specific view component.
2. Replace any fixed-destination back behavior with true previous in-app navigation when a usable previous entry exists.
3. Add a safe fallback for direct entry, external previous page, unavailable previous state, or missing navigation context.
4. Preserve existing workbench context as standard back navigation would; only add explicit state capture if current behavior loses required context.
5. Keep the control semantic and accessible by role/name, with matching pointer and keyboard behavior.

## Manual Validation

1. From `surface/`, run `bun run dev` or use the existing root `just dev` workflow.
2. Navigate from Home to Library or Tasks, activate `<- back`, and confirm the previous view is restored.
3. Navigate through at least three states, activate `<- back`, and confirm it returns one step rather than to a fixed destination.
4. Open a deep link or bookmarked URL directly, activate `<- back`, and confirm the user remains in Surface at a safe default.
   - `?view=doc&ref=...` falls back to Library.
   - `?view=library`, `?view=search`, and `?view=tasks` fall back to Home if Back is activated without prior in-app context.
   - Any missing or same-destination history uses the default Home fallback rather than browser history.
5. Tab to the control, activate it with keyboard, and confirm the result matches pointer activation.
6. Confirm the control has an understandable accessible name in browser devtools or Playwright role queries.

## Automated Validation

```bash
cd surface
bun run check
bun run lint
bun run test:unit -- --run
bun run test:e2e
```

Use targeted test commands during development if the full suite is slow, but run the relevant Surface checks before handing off.

## A11Y / Language Notes

- WCAG 2.2 AA applies to this navigation control.
- The Back controls use native buttons and do not opt into custom focus retention; focus must not remain on a removed Back control after navigation.
- No bilingual content work is planned because scoped UI copy remains English-only.
- CLI accessibility checks are not applicable because terminal output is not changed.
