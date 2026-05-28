# Quickstart: Validate Windows Installer Asset Download Fix

## Regression Test First

Before changing `install.ps1`, add a regression check that proves a release metadata payload without `lattice-agent-x86_64-pc-windows-msvc.exe` fails before download with a clear missing-asset message.

Suggested cases:

1. Metadata contains all Windows assets and each asset resolves to its `browser_download_url`.
2. Metadata omits `lattice-agent-x86_64-pc-windows-msvc.exe` and installation stops before `Invoke-WebRequest`.
3. `-SkipTray` skips `lattice-tray-x86_64-pc-windows-msvc.exe` lookup.

## Parser Validation

Run PowerShell parser validation when `pwsh` is available:

```powershell
pwsh -NoProfile -Command "$tokens=$null; $errors=$null; [System.Management.Automation.Language.Parser]::ParseFile('install.ps1',[ref]$tokens,[ref]$errors) | Out-Null; if ($errors) { $errors; exit 1 }"
```

If PowerShell is unavailable on the development machine, document that parser validation is pending Windows or CI verification.

## Manual Smoke Test

On Windows, run:

```powershell
.\install.ps1 -SpineUrl https://lattice.example.com -AgentToken "<token>" -SkipTray
```

Expected result:

- The installer prints the latest release tag.
- The installer downloads `lattice-agent.exe` and `lattice-capture.exe` from release asset `browser_download_url` values.
- No GitHub `Page not found` HTML is displayed or written as a binary.
- If an asset is missing, the installer prints a concise plain-text missing-asset error.

## Full Validation

Run broader checks if implementation touches more than `install.ps1`:

```bash
just lint
just check
```

If only installer script logic changes, record PowerShell parser validation and targeted regression results in the implementation notes.
