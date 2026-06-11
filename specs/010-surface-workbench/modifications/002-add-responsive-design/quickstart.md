# Quickstart: Add Responsive Design To Surface UI

## Prerequisites

- Install repository dependencies per root setup (`just install`).
- Run spine and Surface together with `just dev`, or Surface alone with its dev
  proxy while spine is available.

## Implementation Loop

1. **Foundation**: add `--bp-phone` / `--bp-tablet` tokens to
   `surface/src/routes/layout.css`; add the shared touch-target rule to
   `surface/src/lib/styles/components.css`.
2. **Baseline**: capture desktop (1280px) Playwright snapshots before migrating
   any existing breakpoint.
3. **Split collapse**: update `surface/src/components/workbench/WorkbenchShell.svelte`
   so the focused pane is full width at `<= --bp-tablet`; do not mutate
   `workbench.svelte.ts` state.
4. **Migrate**: realign existing media queries (shell, settings drawer, search,
   home, editor) to the shared tokens; re-run desktop snapshots after each.
5. **Zero-coverage views**: add responsive rules to tasks, inbox action rows,
   and the overlays so they stack/reflow at phone width.
6. **Tests**: add/extend Playwright e2e at phone (390px), tablet (820px),
   desktop (1280px), plus touch-target checks under coarse pointer.

## Validation

```bash
cd surface && bun run check
cd surface && bun run lint
cd surface && bun run test:e2e
```

Manual smoke (optional, via browser devtools device toolbar or Playwright):
- 390px: workbench split shows a single pane; capture/palette/nav reachable; no
  horizontal page scroll; tasks/inbox/overlays reflow.
- 820px: collapse threshold behaves; overlays usable.
- 1280px: layout matches current desktop (no visual change).

## Definition of Done

- Shared breakpoint tokens are the only source of phone/tablet thresholds.
- Split view collapses to a single pane at `<= --bp-tablet`.
- Touch targets meet 44x44px under coarse pointer / narrow.
- Primary actions reachable at all breakpoints.
- Desktop e2e snapshots unchanged.
- `bun run check`, `bun run lint`, and e2e all green.
