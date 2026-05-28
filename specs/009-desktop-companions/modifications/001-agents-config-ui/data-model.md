# Data Model: Config UI Watch Path File Picker

## Watch Path Row

**Purpose**: Editable representation of one `[[agent.watch]]` entry in the configuration companion.

**Fields**: path string, pattern strings, row validation state, optional user-facing status/error text.

**Identity**: Row position in the config editor until saved back to TOML.

**Validation**: Path must remain a string accepted by existing config validation. Blank paths, duplicate rows, quotes, backslashes, tilde paths, and platform-specific separators must follow the same rules for typed and picker-selected values.

**Lifecycle**: Loaded from TOML or created in UI -> edited manually or updated by picker -> validated on save -> written to the existing TOML watch entry or left unchanged on cancel.

## Picker Selection Request

**Purpose**: User action that opens a native folder picker for a specific watch row.

**Fields**: target row index, starting directory hint if available, dialog title/label text.

**Identity**: Transient UI event; not persisted.

**Validation**: The target row must still exist when the selection result is applied.

**Lifecycle**: Button activated -> dialog opens or reports unavailable/failure -> result is selected, canceled, or failed.

## Picker Selection Result

**Purpose**: Outcome of a picker request.

**Fields**: selected path string when successful, canceled flag, optional failure message.

**Identity**: Transient result for one request.

**Validation**: Successful selected paths update the same row path string used by manual editing. Canceled or failed results must not mutate the previous row value.

**Lifecycle**: Returned from picker -> successful selection updates watch row state -> cancel/failure preserves prior value and optionally updates status text -> normal save/cancel flow continues.

## Config Save

**Purpose**: Existing operation that serializes edited connection/watch settings to local TOML.

**Fields**: spine settings, agent settings, watch rows, validation diagnostics.

**Identity**: One local config file per platform/user.

**Validation**: Required fields must be non-empty and readable. Picker-selected paths must not bypass config validation or TOML preservation logic.

**Lifecycle**: User edits settings -> optionally selects a path through picker -> save validates all fields -> atomic write preserves comments/formatting where existing editor supports it -> optional reindex/restart prompt remains unchanged.
