# Contract Delta: Desktop Companions Config Editor

This contract updates the original Desktop Companions config editor behavior in `specs/009-desktop-companions/contracts/desktop-companions.md`. It does not change spine APIs, IPC commands, queue storage, service contracts, or the TOML file shape.

## Configuration TOML Shape

Unchanged. Watch paths continue to be stored as strings in `[[agent.watch]]` entries.

```toml
[[agent.watch]]
path = "~/Documents"
patterns = ["**/*.md", "**/*.txt", "**/*.pdf"]
```

## Config Editor Behavior

- Each watch path row must expose a user-visible picker control for selecting a filesystem directory.
- Manual path editing must remain available, or an explicitly documented accessible fallback must provide equivalent correction capability.
- A successful picker selection updates the row's path field and uses the same validation and save behavior as a manually typed path.
- Canceling the picker leaves the row's existing path unchanged.
- Picker launch or selection failure leaves the row's existing path unchanged and shows clear text feedback when user action is required.
- Save continues to preserve comments and unrelated formatting where possible, write atomically, remove empty watch patterns, and use the existing TOML representation.
- Reindex/restart prompts after saved watch-directory changes remain unchanged.

## Accessibility Contract

- The picker control must have an understandable text label such as `Choose...` or `Browse...` next to the watch path field.
- The selected/canceled/failed state must not rely on icon-only or color-only cues.
- Keyboard access must be verified for the `eframe` control and documented for the platform dialog where feasible.
- If the native picker is unavailable, the UI must retain manual path entry and provide plain text feedback if the user needs to take action.

## Test Contract

- Successful picker selection updates the intended watch row and saving writes the selected value to `path` without changing the TOML shape.
- Picker cancellation preserves the previous path value.
- Picker failure preserves the previous path value and reports actionable text when appropriate.
- Manually typed paths still validate and save through the same code path as picker-selected paths.
