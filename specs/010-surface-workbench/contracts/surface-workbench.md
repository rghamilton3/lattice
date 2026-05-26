# Contracts: Surface Workbench

## Component Boundary

Surface communicates with spine exclusively through relative `/api/*` requests. It does not import spine code, read SQLite directly, or require new backend routes for this feature.

## Runtime Shell Contract

- The production app is a static SvelteKit build served from `/` by spine.
- The app uses a fallback document so direct navigation to supported query URLs still loads the shell.
- Dev mode proxies `/api` to `http://localhost:3000` and injects development-only Authentik headers.
- User-facing state must remain usable if any individual API request fails.

## Deep Link Contract

Supported query parameters:

```text
/?view=home
/?view=library
/?view=search
/?view=doc&ref=<encoded-doc-ref>
```

Behavior:

- Valid document references open in pane 0.
- Invalid references show a plain toast or inline message and fall back to a usable workbench state.
- A document view without a reference falls back to home.

## Workbench State Contract

Allowed pane contents:

```ts
home
library(query)
results(source)
doc(ref)
editor(slug)
tasks
```

Rules:

- Pane 0 always exists.
- Pane 1 is optional and may be closed.
- Opening in the other pane creates or replaces pane 1.
- Focus follows the pane most recently opened or selected.
- Overlay state is mutually exclusive and is not persisted.
- Persisted preferences are limited to theme, density, font, posture, focus mode, and Vim mode.

## API Usage Contract

Existing Surface API wrappers remain the only data access path:

- `GET /api/status` for spine/agent summary.
- Capture list/detail/triage/create endpoints for home, quick capture, and reading.
- Search endpoints for library and lateral results.
- File detail/content endpoints for indexed local files and PDFs.
- Working document list/detail/create/update endpoints for reading and editing.
- Attachment upload/list endpoints for capture and working documents.
- Task list/create/update endpoints for home preview and tasks view.

Failure behavior:

- Loading states must be visible where the user is waiting.
- Errors must be plain text and local to the failing surface where possible.
- One failing API must not make unrelated panes unusable.

## Keyboard Contract

Core shortcuts:

- `c`: open quick capture when no text-entry target or modal owns focus.
- `Ctrl/Meta+J`: open quick capture.
- `Ctrl/Meta+Shift+J`: open new working doc.
- `Ctrl/Meta+K`: open command palette.
- `Ctrl/Meta+/`: open library/search.
- `Ctrl/Meta+.`: toggle focus mode.
- `Ctrl+Alt+V`: toggle Vim mode.
- `?`: open command palette/help discovery when safe.

Rules:

- Text inputs, textareas, contenteditable nodes, CodeMirror/editor flows, and triage mode own their keys.
- Escape closes popover overlays where appropriate.
- Command palette supports arrow navigation and Enter selection.
- Keyboard behavior must be covered by existing or new tests where feasible.

## Accessibility Contract

- Pane containers are named regions.
- Icon-only buttons include accessible names.
- Dialogs/drawers include roles and labels.
- Status, loading, and errors are provided as text.
- Focus cannot be permanently trapped in an overlay.
- Reduced-motion preferences are respected through global CSS.
- Accessibility evidence is stored in `docs/accessibility/surface-workbench.md`.

## Non-Contract Items

- No new spine migrations.
- No new agent behavior.
- No new hosted service.
- No localization infrastructure in this feature.
