# Quickstart: Config UI Watch Path File Picker

## Local Development Checks

```bash
cd agent
cargo test
cargo test --features gui
cargo build --features gui --bin lattice-config
```

## Manual Smoke: Select Watch Directory

1. Start `lattice-config` with a config file containing at least one `[[agent.watch]]` row.
2. Activate the watch path row's picker button.
3. Select a directory.
4. Verify the selected path appears in the row's path field.
5. Save the config.
6. Verify the TOML still uses `[[agent.watch]] path = "..."` and preserves unrelated comments/formatting where the original editor supports preservation.

## Manual Smoke: Cancel Preserves Path

1. Start `lattice-config` with a watch row that already has a path.
2. Activate the watch path row's picker button.
3. Cancel the picker.
4. Verify the previous path remains visible and save/cancel controls still behave normally.

## Manual Smoke: Manual Fallback

1. Edit the watch path text field manually.
2. Save the config.
3. Verify the manually typed path is validated and saved with the same TOML shape as a picker-selected path.

## Accessibility Evidence To Record

- Picker button text label and adjacent watch path label.
- Keyboard/focus behavior for activating the picker control where supported by `eframe` and the platform dialog.
- Plain text behavior for cancel/failure/unsupported picker states.
- Confirmation that the UI does not rely on color-only or icon-only state.
- Bilingual delivery remains N/A because this modification adds English-only local companion copy and no translation framework.

## CLI Accessibility Check

No user-facing terminal output is expected. If picker launch failure adds terminal diagnostics, verify the output is readable plain text and does not rely on color-only state.
