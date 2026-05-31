# Research: Back Button Navigation

## Decision: Use SvelteKit/browser history semantics for true back behavior

**Rationale**: SvelteKit navigation creates browser history entries for app navigation. SvelteKit documents `$app/navigation` APIs such as `goto`, `beforeNavigate`, `afterNavigate`, `pushState`, and `replaceState`; browser/SvelteKit history traversal is the natural way to return to the previous entry. This best matches user expectations for a control labeled `<- back` and preserves normal route/page state behavior.

**Alternatives considered**: Always navigate to Home or Library was rejected because it is the current broken/fixed-destination behavior. Building an unrelated custom router was rejected as unnecessary abstraction and risk. Using only `goto('/some-default')` was rejected because it cannot return to the actual previous page.

## Decision: Keep fallback in-app and page-appropriate when prior history is not usable

**Rationale**: Direct entry, reload, bookmark, PWA launch, and external referrer flows may not have a usable previous in-app entry. The spec requires a safe destination rather than failing or leaving the app. The fallback should be chosen from existing product navigation patterns, with Home as the broad safe default unless a page has a more relevant existing parent.

**Alternatives considered**: Always call browser back was rejected because it can leave the app or do nothing on direct entry. Disabling the control was rejected because it can strand users and complicates accessibility expectations.

## Decision: Contain implementation to Surface workbench/shell state

**Rationale**: The affected behavior is browser UI navigation in `surface/`. Existing `WorkbenchShell.svelte` handles top-level workbench navigation via `handleNav`, and `WorkbenchStore` owns panes, focused pane, overlays, and view derivation. Keeping the fix here preserves monorepo boundaries and avoids touching spine APIs or persisted data.

**Alternatives considered**: Adding a spine endpoint or persisted navigation table was rejected because back behavior is session UI state, not server data. Introducing a shared navigation framework was rejected under Simplicity over Abstraction.

## Decision: Preserve normal page/workbench context rather than invent new persistence

**Rationale**: SvelteKit supports state restoration through browser history and snapshots for ephemeral DOM state. This feature should preserve the same context users get from standard back navigation and only add snapshots or explicit state capture if implementation finds current workbench context is otherwise lost.

**Alternatives considered**: Persisting all workbench navigation state to local storage was rejected because it expands scope and may restore stale context across sessions. Ignoring context was rejected because the spec explicitly covers filters, selected item, scroll, and unsaved in-page state where normally preserved.

## Decision: Accessibility remains part of the implementation contract

**Rationale**: SvelteKit provides route announcements and focus handling for client-side routing, while Svelte compile-time accessibility checks help catch markup issues. The back control itself remains application responsibility: it must be keyboard-reachable, activatable, and announced with an understandable name.

**Alternatives considered**: Treating the label as visual-only was rejected because WCAG 2.2 AA applies to user-facing navigation. Custom focus retention was deferred unless required because SvelteKit warns that preserving focus can confuse assistive tech if the element disappears.

## Decision: Validate with Playwright plus focused unit tests if state logic is extracted

**Rationale**: The core behavior is user navigation in a browser history stack, so Playwright e2e can verify realistic page-to-page, direct-entry, external-history fallback, repeated activation, and keyboard/accessibility flows. Unit tests are useful if reusable store logic is added to decide fallback or history-stack eligibility.

**Alternatives considered**: Manual testing only was rejected because navigation regressions are easy to reintroduce. Network-heavy e2e was rejected; existing tests stub `/api/*`, and this feature can follow that pattern.
