$ErrorActionPreference = 'Stop'
Set-StrictMode -Version Latest

$repoRoot = Split-Path -Parent $PSScriptRoot
$installScript = Join-Path $repoRoot 'install.ps1'

$env:LATTICE_INSTALLER_IMPORT_ONLY = '1'
. $installScript -SpineUrl 'https://lattice.example.com' -AgentToken 'test-token' -SkipTray
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

$emptyArgumentActionParams = Resolve-ScheduledTaskActionParameters -ExePath 'C:\lattice\lattice-agent.exe'
Assert-Equal -Actual $emptyArgumentActionParams.Execute -Expected 'C:\lattice\lattice-agent.exe' -Message 'Task action should include executable path.'
Assert-Equal -Actual $emptyArgumentActionParams.ContainsKey('Argument') -Expected $false -Message 'Task action should omit empty Argument parameter.'

$promptActionParams = Resolve-ScheduledTaskActionParameters -ExePath 'C:\lattice\lattice-capture.exe' -Arguments '--prompt'
Assert-Equal -Actual $promptActionParams.Execute -Expected 'C:\lattice\lattice-capture.exe' -Message 'Task action with arguments should include executable path.'
Assert-Equal -Actual $promptActionParams.Argument -Expected '--prompt' -Message 'Task action should preserve non-empty arguments.'

$taskRegistrationParams = Resolve-ScheduledTaskRegistrationParameters -TaskName 'LatticeAgent' -Action 'action' -Trigger 'trigger' -Settings 'settings'
Assert-Equal -Actual $taskRegistrationParams.TaskName -Expected 'LatticeAgent' -Message 'Task registration should include task name.'
Assert-Equal -Actual $taskRegistrationParams.Action -Expected 'action' -Message 'Task registration should include action.'
Assert-Equal -Actual $taskRegistrationParams.Trigger -Expected 'trigger' -Message 'Task registration should include trigger.'
Assert-Equal -Actual $taskRegistrationParams.Settings -Expected 'settings' -Message 'Task registration should include settings.'
Assert-Equal -Actual $taskRegistrationParams.ErrorAction -Expected 'Stop' -Message 'Task registration should fail fast on scheduler errors.'
Assert-Equal -Actual $taskRegistrationParams.ContainsKey('Principal') -Expected $false -Message 'Task registration should use the current user instead of an explicit principal.'

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
