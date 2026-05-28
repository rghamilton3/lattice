# Contract: Windows Installer Release Assets

## Installer Inputs

- `-SpineUrl`: required Lattice Spine URL, unchanged by this bugfix.
- `-AgentToken`: required bearer token, unchanged by this bugfix.
- `-SkipTray`: optional switch; when present, tray binary lookup and download are skipped.

## Release Metadata Contract

The installer must request latest release metadata from:

```text
https://api.github.com/repos/rghamilton3/lattice/releases/latest
```

The response must include:

```json
{
  "tag_name": "agent-v0.10.0",
  "assets": [
    {
      "name": "lattice-agent-x86_64-pc-windows-msvc.exe",
      "browser_download_url": "https://github.com/rghamilton3/lattice/releases/download/agent-v0.10.0/lattice-agent-x86_64-pc-windows-msvc.exe"
    }
  ]
}
```

## Required Asset Names

- `lattice-agent-x86_64-pc-windows-msvc.exe` -> `%LOCALAPPDATA%\lattice\lattice-agent.exe`
- `lattice-capture-x86_64-pc-windows-msvc.exe` -> `%LOCALAPPDATA%\lattice\lattice-capture.exe`
- `lattice-tray-x86_64-pc-windows-msvc.exe` -> `%LOCALAPPDATA%\lattice\lattice-tray.exe` unless `-SkipTray` is set

## Failure Contract

If an expected asset is missing, the installer must stop with a plain-text message that includes:

- the missing asset name
- the latest release tag if available
- a statement that the release asset was not found

The installer must not attempt to write GitHub 404 HTML into the binary destination.

## Accessibility Contract

Installer output must remain readable without color and must be suitable for copy/paste diagnostics. Failure messages must not rely on ANSI formatting, glyphs, or color-only meaning.
