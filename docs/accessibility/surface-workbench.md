# Surface Workbench Accessibility Evidence

## Scope

Reviewed the Surface workbench shell, pane routing, reading view, command palette, quick capture overlay, settings drawer, status bar, keyboard shortcuts, responsive layout, and related test coverage.

## WCAG 2.2 AA Checks

- Keyboard operation: primary shell actions use native buttons; command palette, quick capture, settings, and new-doc overlays support keyboard operation; Escape closes non-triage overlays; global shortcuts do not fire while focus is in inputs, ARIA textboxes, contenteditable regions, or CodeMirror editors.
- Names, roles, values: shell icon buttons expose accessible names, pane regions include labels, command palette results use listbox/option semantics, quick capture icon buttons have explicit labels, Back controls expose the `Back to previous view` button name, and the settings drawer uses grouped labeled controls.
- Status and errors: invalid deep links produce a visible status toast; Surface status text reports unavailable agents instead of relying on an icon; reading panes preserve loading and error text; capture failures remain inline in the dialog.
- Color not alone: status, agent availability, capture validation, and settings state include text labels, not only color or icon changes.
- Motion and responsiveness: existing reduced-motion styles remain in place, and narrow viewports wrap shell controls/status text so navigation, palette, capture, and settings remain reachable without horizontal-only interaction.
- Rich content safety: markdown rendering remains sanitized and now falls back to escaped plain text if rich rendering fails or stale async rendering resolves out of order.

## Automated Evidence

- `cd surface && bun run check`
- `cd surface && bun run test:unit`
- `cd surface && bun run test:e2e`
- `cd surface && bun run lint`

The E2E suite covers invalid deep-link status feedback, keyboard shortcut suppression while typing in library search, split-pane reading behavior, command palette navigation, quick capture success/failure, settings theme controls, process mode, search facet filtering, Back from Home-opened documents, Back from Library search results, direct document deep-link fallback to Library, repeated document/editor Back traversal, role/name discovery, Enter/Space activation, and focus not remaining on a removed Back control.

## Bilingual Delivery

N/A. Surface remains English-only for this phase and no translation resources or bilingual UI contract exists. New and reviewed copy is local workbench UI/status text only.

## Residual Risks

- Browser and assistive-technology behavior for `autofocus` in modal dialogs varies; the affected dialogs are opened by explicit user action and expose visible labels and keyboard controls.
- Mermaid, KaTeX, and PDF rendering depend on third-party renderers; fallback text/error states are provided, but future renderer upgrades should repeat keyboard and screen-reader checks.
- Additional workbench overlays should continue using explicit labels and should be tested against the global shortcut ownership rules.
