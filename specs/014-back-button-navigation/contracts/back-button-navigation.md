# UI Contract: Back Button Navigation

## Scope

This contract covers every Surface control presented to users as `<- back` or equivalent back navigation.

## Activation Contract

| Condition | User action | Expected result |
|-----------|-------------|-----------------|
| Current view has a usable previous in-app page/state | Activate `<- back` with pointer | Return to the immediately previous in-app page/state |
| Current view has a usable previous in-app page/state | Focus `<- back` and press `Enter` or `Space` | Same result as pointer activation |
| Current view was opened directly with no usable previous page/state | Activate `<- back` | Navigate to the safe fallback destination for that context |
| Previous history entry is external or unsafe | Activate `<- back` | Stay in the application and navigate to the safe fallback destination |
| User activates back repeatedly | Activate `<- back` more than once | Traverse usable prior in-app states or fall back safely without a confusing loop |

## Accessibility Contract

- The control MUST be discoverable by role and accessible name in browser automation.
- The accessible name MUST communicate the back action, not only expose a decorative arrow.
- Keyboard activation MUST match pointer activation.
- Focus handling after navigation MUST not strand focus on a removed element.
- The implementation MUST continue to pass Svelte/SvelteKit accessibility checks.

## Context Preservation Contract

- Returning to a previous state MUST preserve the same visible context that standard back navigation preserves.
- If implementation cannot preserve a specific piece of context because the app never preserved it before, that limitation must be documented in tests or task notes rather than silently treated as a regression.

## Out Of Scope

- New public HTTP APIs.
- New persistence schemas.
- Cross-device navigation history.
- Browser extension or native OS back-button integration beyond normal web/PWA behavior.
