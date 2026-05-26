# Quickstart: Surface Workbench

## Local Development

From the repository root, run spine and surface together when testing full integration:

```sh
just dev
```

For Surface-only checks:

```sh
cd surface
bun install
bun run dev
```

Surface dev server proxies `/api` to spine on port 3000 and injects development Authentik headers. Spine must run with development settings that accept those headers.

## Manual Verification

1. Open Surface at the dev URL.
2. Confirm the home view renders and shell controls are visible.
3. Open settings, change theme, density, posture, reading font, focus mode, and Vim mode; reload and confirm valid preferences persist.
4. Press `Ctrl+K` or `Meta+K`, search for an action, and open it from the command palette.
5. Press `c` from the shell to open quick capture; verify the same key does not steal focus while typing in a text field.
6. Open library/search, open a capture/file/working doc, then use Split and a lateral action to verify two-pane behavior.
7. Test a valid deep link and an invalid `ref` query parameter.
8. Toggle reduced-motion in the browser/OS and confirm transitions remain minimal.
9. Narrow the viewport and confirm primary navigation, capture, settings, and palette remain reachable.

## Automated Checks

```sh
cd surface
bun run check
bun run test:unit
bun run test:e2e
```

Use targeted tests while iterating if the full suite is too slow:

```sh
cd surface
bun run test:unit -- src/lib/state/workbench.test.ts
bun run test:e2e -- e2e/surface.e2e.ts
```

## Accessibility Evidence

Update `docs/accessibility/surface-workbench.md` with:

- Keyboard coverage for shell shortcuts, command palette, settings, panes, and overlays.
- Text alternatives for icon-only controls and status feedback.
- Reduced-motion and theme/contrast notes.
- Error/loading/status copy review.
- Bilingual N/A rationale for English-only Surface copy.

## Out Of Scope

- Adding new spine APIs or database migrations.
- Replacing the workbench visual direction.
- Adding hosted services or external telemetry.
- Adding localization infrastructure.
