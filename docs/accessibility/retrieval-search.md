# Accessibility Evidence: Retrieval Search

**Feature**: Retrieval Search
**Date**: 2026-05-26

## Scope

- Search result loading, empty, error, and populated states.
- Result row actions: Open, Open in split, Promote, Similar.
- Search filter/facet controls and minimized filter rail.
- File browse and lateral result views when rendered through search result components.

## WCAG 2.2 AA Checks

- [x] Search/results states are communicated with text, not color alone.
- [x] Result actions have visible labels or accessible names.
- [x] Result actions are reachable and operable with keyboard input.
- [x] Filter controls expose state with accessible labels or pressed state.
- [x] Error text is visible and not only logged or toasted.
- [x] Result snippets, metadata, and score indicators remain readable at supported viewport sizes.

## Notes

- Bilingual content is not required for this feature.
- Search and lateral result panels use visible loading, empty, and error text. Loading text uses `role="status"`; API failures use `role="alert"`.
- Result row actions retain visible button labels and now include result-specific accessible names for Open, Open in split, Promote, and Similar actions.
- Relevance score bars expose meter semantics with score labels while preserving the visible numeric score.
- Filter controls expose selected state with `aria-pressed` and include action-oriented labels for kind and sort controls.
- File/library rows are native buttons with explicit open labels and remain keyboard reachable.
- Automated verification on 2026-05-26: `cd spine && bun test tests/routes/search.test.ts tests/routes/lateral.test.ts tests/routes/files.test.ts` passed 47 tests; `cd surface && bun run check` reported 0 errors and 0 warnings.
