# Data Model: Windows Installer Release Asset Download Fix

No persisted application data model changes are required.

## Release Asset Metadata

**Source**: GitHub Releases API response for `https://api.github.com/repos/rghamilton3/lattice/releases/latest`

**Fields Used**:
- `tag_name`: latest release tag displayed to the user and used in diagnostics.
- `assets[].name`: release asset filename to match exactly.
- `assets[].browser_download_url`: URL passed to `Invoke-WebRequest` for the matched asset.

**Validation Rules**:
- `tag_name` must be non-empty before displaying release selection.
- Each required asset name must match exactly one release asset.
- Missing required assets must stop installation before attempting a binary download.
- Download destination paths remain unchanged under `%LOCALAPPDATA%\lattice`.

## Installer Asset Request

**Fields**:
- `Asset`: expected release asset filename.
- `Dest`: local destination file path.
- `Required`: always true for `lattice-agent` and `lattice-capture`; true for `lattice-tray` unless `-SkipTray` is set.

**Relationships**:
- An installer asset request resolves against one release asset metadata entry by exact `name`.
- A successful resolution yields one `browser_download_url` and one local file write.

**State Transitions**:
- `pending` -> `resolved` when matching metadata is found.
- `pending` -> `missing` when no matching metadata exists; installer exits with a clear error.
- `resolved` -> `downloaded` when `Invoke-WebRequest` writes the binary successfully.
