$ErrorActionPreference = 'Stop'
Set-StrictMode -Version Latest

$repoRoot = Split-Path -Parent $PSScriptRoot
$installScript = Join-Path $repoRoot 'install.ps1'

$env:LATTICE_INSTALLER_IMPORT_ONLY = '1'
. $installScript -SpineUrl 'https://lattice.example.com' -AgentToken 'test-token' -SkipTray
. $installScript -Uninstall
Remove-Item Env:LATTICE_INSTALLER_IMPORT_ONLY -ErrorAction SilentlyContinue

$agentAsset = 'lattice-agent-x86_64-pc-windows-msvc.exe'
$captureAsset = 'lattice-capture-x86_64-pc-windows-msvc.exe'
$trayAsset = 'lattice-tray-x86_64-pc-windows-msvc.exe'

function New-TestRelease {
    param([string[]]$AssetNames)

    [pscustomobject]@{
        tag_name = 'agent-v0.10.0'
        assets = @(
            foreach ($assetName in $AssetNames) {
                [pscustomobject]@{
                    name = $assetName
                    browser_download_url = "https://downloads.example.test/agent-v0.10.0/$assetName"
                }
            }
        )
    }
}

function Assert-Equal {
    param([object]$Actual, [object]$Expected, [string]$Message)

    if ($Actual -ne $Expected) {
        throw "$Message Expected '$Expected', got '$Actual'."
    }
}

function Assert-ThrowsLike {
    param([scriptblock]$ScriptBlock, [string[]]$ExpectedFragments, [string]$Message)

    try {
        & $ScriptBlock
    } catch {
        $errorMessage = $_.Exception.Message
        foreach ($fragment in $ExpectedFragments) {
            if ($errorMessage -notlike "*$fragment*") {
                throw "$Message Missing '$fragment' in '$errorMessage'."
            }
        }
        return
    }

    throw "$Message Expected an exception."
}

function Resolve-InstallerDownloads {
    param([object]$Release, [switch]$SkipTray)

    # Keep this in step with the installer download callsites so option-level behavior is covered.
    $downloads = @(
        [pscustomobject]@{ Asset = $agentAsset; Url = Get-ReleaseAssetUrl -Release $Release -Asset $agentAsset }
        [pscustomobject]@{ Asset = $captureAsset; Url = Get-ReleaseAssetUrl -Release $Release -Asset $captureAsset }
    )

    if (-not $SkipTray) {
        $downloads += [pscustomobject]@{ Asset = $trayAsset; Url = Get-ReleaseAssetUrl -Release $Release -Asset $trayAsset }
    }

    $downloads
}

$allAssetsRelease = New-TestRelease -AssetNames @($agentAsset, $captureAsset, $trayAsset)

$shortcutPath = Resolve-StartupShortcutPath -StartupDir 'C:\Users\Bob\AppData\Roaming\Microsoft\Windows\Start Menu\Programs\Startup\' -ShortcutName 'LatticeAgent'
Assert-Equal -Actual $shortcutPath -Expected 'C:\Users\Bob\AppData\Roaming\Microsoft\Windows\Start Menu\Programs\Startup\LatticeAgent.lnk' -Message 'Startup shortcut path should trim trailing slash and append .lnk.'

$hiddenStartCommand = Resolve-HiddenStartCommand -FilePath 'C:\Users\Bob Smith\AppData\Local\lattice\lattice-agent.exe'
Assert-Equal -Actual $hiddenStartCommand -Expected "Start-Process -WindowStyle Hidden -FilePath 'C:\Users\Bob Smith\AppData\Local\lattice\lattice-agent.exe'" -Message 'Hidden start command should hide and detach executable launches.'

$singleQuoteHiddenStartCommand = Resolve-HiddenStartCommand -FilePath "C:\Users\O'Brien\AppData\Local\lattice\lattice-agent.exe"
Assert-Equal -Actual $singleQuoteHiddenStartCommand -Expected "Start-Process -WindowStyle Hidden -FilePath 'C:\Users\O''Brien\AppData\Local\lattice\lattice-agent.exe'" -Message 'Hidden start command should escape single quotes in file paths.'

$shortcutProperties = Resolve-ShortcutProperties -ExePath 'C:\Users\Bob Smith\AppData\Local\lattice\lattice-capture.exe' -Arguments '--prompt'
Assert-Equal -Actual $shortcutProperties.TargetPath -Expected 'powershell.exe' -Message 'Shortcut target should use PowerShell to launch without a visible console window.'
Assert-Equal -Actual $shortcutProperties.Arguments -Expected "-NoProfile -WindowStyle Hidden -Command `"Start-Process -WindowStyle Hidden -FilePath 'C:\Users\Bob Smith\AppData\Local\lattice\lattice-capture.exe' -ArgumentList '--prompt'`"" -Message 'Shortcut arguments should hide and detach command arguments.'
Assert-Equal -Actual $shortcutProperties.WorkingDirectory -Expected 'C:\Users\Bob Smith\AppData\Local\lattice' -Message 'Shortcut working directory should be the executable parent directory.'
Assert-Equal -Actual $shortcutProperties.WindowStyle -Expected 7 -Message 'Shortcut window should start minimized if PowerShell shows a launcher window.'

$rootlessShortcutProperties = Resolve-ShortcutProperties -ExePath 'lattice-agent.exe'
Assert-Equal -Actual $rootlessShortcutProperties.WorkingDirectory -Expected '' -Message 'Shortcut working directory should be empty when no parent directory exists.'

$schtasksEndArgs = Resolve-SchtasksEndArguments -TaskName 'LatticeAgent'
Assert-Equal -Actual ($schtasksEndArgs -join ' ') -Expected '/End /TN LatticeAgent' -Message 'Task stop should use schtasks end arguments.'

$schtasksDeleteArgs = Resolve-SchtasksDeleteArguments -TaskName 'LatticeAgent'
Assert-Equal -Actual ($schtasksDeleteArgs -join ' ') -Expected '/Delete /TN LatticeAgent /F' -Message 'Task unregister should use schtasks delete arguments.'

$uninstallFailureMessage = Format-UninstallFailureMessage -Component 'scheduled task' -Identifier 'LatticeAgent' -Reason 'Access is denied.' -NextAction 'Delete the task manually.'
Assert-Equal -Actual $uninstallFailureMessage -Expected 'scheduled task (LatticeAgent): Access is denied. Next action: Delete the task manually.' -Message 'Uninstall failure message should include component, identifier, reason, and next action.'

Assert-Equal -Actual (Test-SchtasksMissingOutput -Output 'ERROR: The system cannot find the file specified.') -Expected $true -Message 'Missing scheduled task output should be classified as skipped.'
Assert-Equal -Actual (Test-SchtasksMissingOutput -Output 'Access is denied.') -Expected $false -Message 'Permission failure should not be classified as skipped.'
Assert-Equal -Actual (Test-SchtasksBenignStopOutput -Output 'ERROR: The system cannot find the file specified.') -Expected $true -Message 'Missing scheduled task stop output should be classified as benign.'
Assert-Equal -Actual (Test-SchtasksBenignStopOutput -Output 'Access is denied.') -Expected $false -Message 'Permission failure during scheduled task stop should not be classified as benign.'

$script:UninstallRemoved = @()
$script:UninstallPreserved = @()
$script:UninstallSkipped = @()
$script:UninstallFailed = @()
$script:UninstallNextActions = @()
$tempRoot = Join-Path ([System.IO.Path]::GetTempPath()) "lattice-installer-test-$([System.Guid]::NewGuid())"
$binDir = Join-Path $tempRoot 'bin'
$cfgDir = Join-Path $tempRoot 'cfg'
New-Item -ItemType Directory -Force -Path $binDir, $cfgDir | Out-Null
New-Item -ItemType File -Force -Path (Join-Path $binDir 'lattice-agent.exe'), (Join-Path $cfgDir 'config.toml') | Out-Null
try {
    function global:schtasks.exe {
        param([Parameter(ValueFromRemainingArguments = $true)][string[]]$Arguments)

        $global:LASTEXITCODE = 1
        'ERROR: The system cannot find the file specified.'
    }

    $ok = Invoke-LatticeUninstall -BinDir $binDir -CfgDir $cfgDir
    Assert-Equal -Actual $ok -Expected $true -Message 'Default uninstall should succeed when scheduled tasks are already absent.'
    Assert-Equal -Actual (Test-Path -LiteralPath (Join-Path $binDir 'lattice-agent.exe')) -Expected $false -Message 'Default uninstall should remove agent binary.'
    Assert-Equal -Actual (Test-Path -LiteralPath $cfgDir) -Expected $true -Message 'Default uninstall should preserve configuration directory.'
    Assert-Equal -Actual (@($script:UninstallPreserved | Where-Object { $_ -like "Lattice configuration: $cfgDir" }).Count -eq 1) -Expected $true -Message 'Default uninstall should record preserved configuration.'
    Assert-Equal -Actual (@($script:UninstallSkipped | Where-Object { $_ -like 'scheduled task LatticeAgent*already absent' }).Count -eq 1) -Expected $true -Message 'Missing scheduled task should be skipped.'
    Assert-Equal -Actual (@($script:UninstallNextActions | Where-Object { $_ -like '*-Uninstall -PurgeConfig*' }).Count -eq 1) -Expected $true -Message 'Default uninstall should include purge next action.'
} finally {
    Remove-Item function:global:schtasks.exe -ErrorAction SilentlyContinue
    Remove-Item -LiteralPath $tempRoot -Recurse -Force -ErrorAction SilentlyContinue
}

$script:UninstallRemoved = @()
$script:UninstallPreserved = @()
$script:UninstallSkipped = @()
$script:UninstallFailed = @()
$script:UninstallNextActions = @()
$tempRoot = Join-Path ([System.IO.Path]::GetTempPath()) "lattice-installer-test-$([System.Guid]::NewGuid())"
$binDir = Join-Path $tempRoot 'bin'
$cfgDir = Join-Path $tempRoot 'cfg'
New-Item -ItemType Directory -Force -Path $binDir, $cfgDir | Out-Null
New-Item -ItemType File -Force -Path (Join-Path $cfgDir 'config.toml') | Out-Null
try {
    function global:schtasks.exe {
        param([Parameter(ValueFromRemainingArguments = $true)][string[]]$Arguments)

        if ($Arguments[0] -eq '/End') {
            $global:LASTEXITCODE = 1
            'Access is denied.'
            return
        }

        $global:LASTEXITCODE = 1
        'ERROR: The system cannot find the file specified.'
    }

    $ok = Invoke-LatticeUninstall -BinDir $binDir -CfgDir $cfgDir -PurgeConfig
    Assert-Equal -Actual $ok -Expected $false -Message 'Uninstall should fail when scheduled task stop fails.'
    Assert-Equal -Actual (Test-Path -LiteralPath $cfgDir) -Expected $false -Message 'Purge uninstall should remove configuration directory.'
    Assert-Equal -Actual (@($script:UninstallFailed | Where-Object { $_ -like 'scheduled task stop (LatticeAgent): Access is denied.*' }).Count -eq 1) -Expected $true -Message 'Scheduled task stop failure should be recorded.'
    Assert-Equal -Actual (@($script:UninstallRemoved | Where-Object { $_ -like "Lattice configuration: $cfgDir" }).Count -eq 1) -Expected $true -Message 'Purge uninstall should record removed configuration.'
} finally {
    Remove-Item function:global:schtasks.exe -ErrorAction SilentlyContinue
    Remove-Item -LiteralPath $tempRoot -Recurse -Force -ErrorAction SilentlyContinue
}

Assert-Equal `
    -Actual (Get-ReleaseAssetUrl -Release $allAssetsRelease -Asset $agentAsset) `
    -Expected 'https://downloads.example.test/agent-v0.10.0/lattice-agent-x86_64-pc-windows-msvc.exe' `
    -Message 'Agent asset should resolve to browser_download_url.'

Assert-Equal `
    -Actual (Get-ReleaseAssetUrl -Release $allAssetsRelease -Asset $captureAsset) `
    -Expected 'https://downloads.example.test/agent-v0.10.0/lattice-capture-x86_64-pc-windows-msvc.exe' `
    -Message 'Capture asset should resolve to browser_download_url.'

Assert-ThrowsLike `
    -ScriptBlock { Get-ReleaseAssetUrl -Release (New-TestRelease -AssetNames @($captureAsset, $trayAsset)) -Asset $agentAsset } `
    -ExpectedFragments @('Release asset not found', $agentAsset, 'agent-v0.10.0') `
    -Message 'Missing agent asset should fail before download.'

Assert-ThrowsLike `
    -ScriptBlock { Get-ReleaseAssetUrl -Release (New-TestRelease -AssetNames @($agentAsset, $trayAsset)) -Asset $captureAsset } `
    -ExpectedFragments @('Release asset not found', $captureAsset, 'agent-v0.10.0') `
    -Message 'Missing capture asset should fail before download.'

$emptyUrlRelease = [pscustomobject]@{
    tag_name = 'agent-v0.10.0'
    assets = @(
        [pscustomobject]@{
            name = $agentAsset
            browser_download_url = ''
        }
    )
}

Assert-ThrowsLike `
    -ScriptBlock { Get-ReleaseAssetUrl -Release $emptyUrlRelease -Asset $agentAsset } `
    -ExpectedFragments @('Release asset not found', $agentAsset, 'agent-v0.10.0') `
    -Message 'Asset with empty browser_download_url should fail before download.'

$allDownloads = Resolve-InstallerDownloads -Release $allAssetsRelease
Assert-Equal -Actual $allDownloads.Count -Expected 3 -Message 'Default install should resolve all three assets.'
Assert-Equal -Actual (($allDownloads | ForEach-Object Asset) -contains $agentAsset) -Expected $true -Message 'Default install should include agent asset.'
Assert-Equal -Actual (($allDownloads | ForEach-Object Asset) -contains $captureAsset) -Expected $true -Message 'Default install should include capture asset.'
Assert-Equal -Actual (($allDownloads | ForEach-Object Asset) -contains $trayAsset) -Expected $true -Message 'Default install should include tray asset.'

$skipTrayDownloads = Resolve-InstallerDownloads -Release (New-TestRelease -AssetNames @($agentAsset, $captureAsset)) -SkipTray
Assert-Equal -Actual $skipTrayDownloads.Count -Expected 2 -Message 'SkipTray should resolve only required assets.'
if (($skipTrayDownloads | ForEach-Object Asset) -contains $trayAsset) {
    throw 'SkipTray should skip tray asset lookup.'
}

Assert-Equal `
    -Actual (Get-ReleaseAssetUrl -Release $allAssetsRelease -Asset $trayAsset) `
    -Expected 'https://downloads.example.test/agent-v0.10.0/lattice-tray-x86_64-pc-windows-msvc.exe' `
    -Message 'Tray asset should resolve to browser_download_url.'

Write-Host 'windows-installer-assets.ps1: PASS'
