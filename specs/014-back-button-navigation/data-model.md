# Data Model: Back Button Navigation

This feature does not introduce persisted data entities or database schema changes. The model below describes transient UI/navigation concepts used to reason about behavior.

## Back Navigation Entry

**Represents**: A prior in-app workbench/page state that the user can safely return to.

**Fields**:

- `destination`: The previous in-app page or workbench state.
- `source`: The current page or workbench state where `<- back` is activated.
- `isUsable`: Whether the destination is still available and safe to return to.
- `preservedContext`: User-visible context expected to return with the destination, such as filters, selected item, scroll position, pane content, or non-submitted text where already normally preserved.

**Validation Rules**:

- Destination must be inside the application.
- Destination must not be a fixed default when a usable previous in-app entry exists.
- Destination must not create a confusing repeated-back loop.

**State Transitions**:

- `current -> previous`: User activates `<- back` and a usable previous in-app entry exists.
- `current -> fallback`: User activates `<- back` and no usable previous in-app entry exists.

## Safe Fallback Destination

**Represents**: The in-app location used when true back navigation is unavailable or unsafe.

**Fields**:

- `destination`: Existing in-app view selected as the fallback.
- `reason`: Why fallback is used, such as direct entry, external previous page, unavailable prior state, or missing navigation context.

**Validation Rules**:

- Destination must remain inside Surface.
- Destination must be reachable without requiring unavailable prior context.
- Destination must be documented in implementation tests.

## Back Control

**Represents**: The user-facing `<- back` UI affordance.

**Fields**:

- `label`: Visible or accessible text that communicates back navigation.
- `activationMethods`: Pointer and keyboard activation paths.
- `enabledBehavior`: The result of activation in current state.

**Validation Rules**:

- Must be reachable by keyboard.
- Must have an understandable accessible name.
- Pointer and keyboard activation must produce identical navigation behavior.
