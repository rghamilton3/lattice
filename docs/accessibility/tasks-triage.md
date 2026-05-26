# Tasks And Triage Accessibility Evidence

## Scope

Reviewed user-facing changes for process mode, the home task preview, task creation dialog, active/completed task list, task metadata editing, and completion/restore feedback.

## WCAG 2.2 AA Checks

- Keyboard operation: process-mode actions are native buttons and have matching keyboard shortcuts; Escape exits process mode; the new-task dialog traps Tab and supports Escape; task edit fields and completed toggles are keyboard reachable.
- Names, roles, values: process buttons, complete buttons, restore buttons, edit buttons, save controls, progress bar, and dialog fields expose descriptive labels. The completed section uses `aria-expanded` and `aria-controls`.
- Status and errors: loading states use polite status regions, failures use alert/status semantics, task save/restore states are announced, and toasts remain supplemental rather than the only feedback.
- Focus visibility: controls use existing button/input focus styles; no custom focus suppression was introduced.
- Color not alone: task priority is shown with text labels in addition to color; errors include text, not only red styling; process progress includes numeric position text.
- Motion: existing process progress animation respects `prefers-reduced-motion`.

## Bilingual Delivery

N/A. This feature adds English-only copy to an English-only surface. No bilingual requirement exists for this phase.

## Residual Risks

- Process-mode global shortcuts intentionally activate only while process mode is open; future modal additions inside process mode should avoid shortcut conflicts.
- Browser date input accessibility varies by platform; labels and surrounding task context are provided.
