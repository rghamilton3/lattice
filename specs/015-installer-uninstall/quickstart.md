# Quickstart: Validate Installer Uninstall Option

## Regression Test First

Before changing installer behavior, add focused checks for uninstall decision logic and argument parsing.

Suggested cases:

1. Default install invocation still requires the same inputs and follows the existing install path.
2. Uninstall invocation does not require install-only inputs such as spine URL or agent token.
3. Default uninstall preserves configuration paths and reports them as preserved.
4. Complete-removal uninstall removes configuration only when the explicit purge option is present.
5. Missing binaries, services, tasks, or optional components are reported as skipped/already removed, not fatal errors.
6. Removal failures include the component name and a plain-text next action.

## Parser And Syntax Validation

Run PowerShell parser validation when `pwsh` is available:

```powershell
pwsh -NoProfile -Command "$tokens=$null; $errors=$null; [System.Management.Automation.Language.Parser]::ParseFile('install.ps1',[ref]$tokens,[ref]$errors) | Out-Null; if ($errors) { $errors; exit 1 }"
```

Run Bash syntax validation:

```bash
bash -n install.sh
```

If PowerShell is unavailable on the development machine, document that parser validation is pending Windows or CI verification.

## Manual Linux Smoke Test

On a Linux environment where the installer artifacts can be safely created and removed, run:

```bash
./install.sh --uninstall
```

Expected result:

- The command does not fetch release metadata or download binaries.
- User service entries are stopped/disabled/removed when present.
- Installer-managed binaries are removed when present.
- Configuration is preserved by default and the preserved path is printed.
- Missing optional components are reported as skipped.

For complete removal, run only when safe:

```bash
./install.sh --uninstall --purge-config
```

Expected result: configuration removal is explicit in the output.

## Manual Windows Smoke Test

On Windows, run:

```powershell
.\install.ps1 -Uninstall
```

Expected result:

- The command does not require `-SpineUrl` or `-AgentToken`.
- The command does not fetch release metadata or download binaries.
- Installer-managed scheduled tasks are stopped or unregistered when present.
- Installer-managed binaries are removed when present.
- Configuration is preserved by default and the preserved path is printed.
- Missing optional components are reported as skipped.

For complete removal, run only when safe:

```powershell
.\install.ps1 -Uninstall -PurgeConfig
```

Expected result: configuration removal is explicit in the output.

## Accessibility And Language Validation

Review all new terminal output:

- Messages are plain text and copyable.
- Meaning does not depend on color, icons, glyph-only symbols, or animation.
- Failure messages name the affected component and provide a next action.
- English-only delivery remains documented as intentional because current installer scripts and docs are English-only and no translation resource exists for this feature.

## Full Validation

Run broader checks if implementation touches more than installer scripts and installer-specific tests:

```bash
just lint
just check
```

Record parser/syntax validation, targeted regression results, and any platform smoke-test limitations in implementation notes.

## Implementation Notes

- Bash syntax validation passed with `bash -n install.sh`.
- Bash uninstall regression tests passed with `bash tests/linux-installer-uninstall.sh`.
- PowerShell parser validation passed with the command listed above.
- PowerShell installer regression tests passed with `pwsh -NoProfile -File tests/windows-installer-assets.ps1`.
- Manual platform smoke tests remain optional because targeted tests use temporary paths and avoid destructive live installs.
