# Quickstart: Verify Command Palette Focus Fix

## Static Checks

From `surface/`:

```bash
bun run check
```

## Targeted E2E Check

From `surface/`:

```bash
bun run test:e2e -- surface.e2e.ts -g "command palette: \? opens palette and focuses the search input"
```

Expected result: the Playwright test opens the app, presses `?`, verifies the command palette dialog is visible, and verifies the `Command palette search` textbox is focused.

## Manual Verification

1. Start the surface app.
2. Open the home view with focus outside an input.
3. Press `?`.
4. Confirm the command palette opens and the caret is in the search textbox.
5. Type a search query without clicking; text should appear in the palette search textbox.
