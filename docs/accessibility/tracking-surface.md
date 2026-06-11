# Tracking Surface Accessibility Evidence

## Scope

Tracking Surface adds search, record detail, browser-created records, board organization, and follow-up actions inside the existing Surface workbench.

## WCAG 2.2 AA Notes

- Keyboard: search, save, create-bin, move, checkout, and follow-up actions are native form controls or buttons. Pointer movement is not required because each card has select-and-place controls.
- Focus: navigation opens tracking in the current pane without hidden modal focus traps. Stable detail links render in the same pane with a Workspace return button.
- Status messaging: search, save, refresh, and error outcomes use `role="status"`, `aria-live="polite"`, or `role="alert"`.
- Accessible names: controls have visible labels or explicit `aria-label`; photo input accepts image types and record photos include descriptive alt text.
- Non-color state: displaced/away state is rendered as text pills, not color alone.
- Responsive reflow: the workspace collapses two-column search/detail grids to one column below 760px and uses wrapping inline controls to avoid page-level horizontal scrolling.
- Photo fallback: text records remain usable without a photo; missing server-side photo files return 404 without breaking record detail JSON.

## Copy Review

Tracking user-facing copy avoids debt, overdue, backlog, streak, and failure framing. Follow-ups are presented as lightweight prompts with Still there, Still out, Moved, and Skip actions.

## Bilingual Delivery

Not applicable for this feature. The spec requires English-only copy and no bilingual acceptance criteria.
