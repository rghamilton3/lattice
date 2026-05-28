<#
.SYNOPSIS
    Installs lattice-agent on Windows.

.DESCRIPTION
    Downloads the latest lattice-agent release binaries, installs them to
    %LOCALAPPDATA%\lattice\, writes a starter config to %APPDATA%\lattice\,
    and registers two Task Scheduler tasks that run at logon:
      - LatticeAgent     : the background indexer
      - LatticeTray      : the system-tray monitor

.PARAMETER SpineUrl
    URL of your Lattice Spine instance (e.g. https://lattice.example.com).

.PARAMETER AgentToken
    Bearer token for the agent to authenticate with Spine.

.PARAMETER SkipTray
    Install the agent only; do not install or register the tray icon.

.EXAMPLE
    .\install.ps1 -SpineUrl https://lattice.example.com -AgentToken "abc123"
#>
[CmdletBinding(SupportsShouldProcess)]
param(
    [Parameter(Mandatory)]
    [string]$SpineUrl,

    [Parameter(Mandatory)]
    [string]$AgentToken,

    [switch]$SkipTray
)

Set-StrictMode -Version Latest
$ErrorActionPreference = 'Stop'

$Repo    = 'rghamilton3/lattice'

# ── Helpers ───────────────────────────────────────────────────────────────────

function Get-LatestReleaseMetadata {
    $api = "https://api.github.com/repos/$Repo/releases/latest"
    $release = Invoke-RestMethod -Uri $api -Headers @{ 'User-Agent' = 'lattice-installer' }
    if (-not $release.tag_name) {
        throw 'Latest release metadata did not include a tag_name.'
    }
    $release
}

function Get-ReleaseAssetUrl {
    param([object]$Release, [string]$Asset)

    $match = $Release.assets | Where-Object { $_.name -eq $Asset } | Select-Object -First 1
    if (-not $match -or -not $match.browser_download_url) {
        throw "Release asset not found: $Asset in release $($Release.tag_name)."
    }

    $match.browser_download_url
}

function Download-Asset {
    param([string]$Url, [string]$Asset, [string]$Dest)
    Write-Host "  Downloading $Asset ..."
    Invoke-WebRequest -Uri $Url -OutFile $Dest -UseBasicParsing
}

function Resolve-ScheduledTaskRunCommand {
    param([string]$ExePath, [string]$Arguments = '')

    $taskRun = "`"$ExePath`""
    if (-not [string]::IsNullOrEmpty($Arguments)) {
        $taskRun = "$taskRun $Arguments"
    }

    $taskRun
}

function Resolve-SchtasksCreateArguments {
    param([string]$TaskName, [string]$TaskRun)

    @('/Create', '/TN', $TaskName, '/TR', $TaskRun, '/SC', 'ONLOGON', '/F')
}

function Invoke-Schtasks {
    param([string[]]$Arguments, [string]$TaskName)

    $output = & schtasks.exe @Arguments 2>&1
    if ($LASTEXITCODE -ne 0) {
        throw "Failed to register scheduled task '$TaskName': $output"
    }
}

function Register-LogonTask {
    param([string]$TaskName, [string]$ExePath, [string]$Arguments = '')
    $taskRun = Resolve-ScheduledTaskRunCommand -ExePath $ExePath -Arguments $Arguments
    $schtasksArgs = Resolve-SchtasksCreateArguments -TaskName $TaskName -TaskRun $taskRun

    Write-Host "  Creating or updating task: $TaskName"
    Invoke-Schtasks -Arguments $schtasksArgs -TaskName $TaskName
}

if ($env:LATTICE_INSTALLER_IMPORT_ONLY -eq '1') {
    return
}

$BinDir  = Join-Path $env:LOCALAPPDATA 'lattice'
$CfgDir  = Join-Path $env:APPDATA      'lattice'
$CfgFile = Join-Path $CfgDir           'config.toml'

# ── Install ───────────────────────────────────────────────────────────────────

Write-Host "Lattice Agent installer"
Write-Host "========================"

Write-Host "`nFetching latest release metadata ..."
$release = Get-LatestReleaseMetadata
$tag = $release.tag_name
Write-Host "  Release tag: $tag"

Write-Host "`nCreating install directories ..."
New-Item -ItemType Directory -Force -Path $BinDir | Out-Null
New-Item -ItemType Directory -Force -Path $CfgDir | Out-Null

Write-Host "`nDownloading binaries ..."
$agentExe  = Join-Path $BinDir 'lattice-agent.exe'
$captureExe = Join-Path $BinDir 'lattice-capture.exe'
$agentAsset = 'lattice-agent-x86_64-pc-windows-msvc.exe'
$captureAsset = 'lattice-capture-x86_64-pc-windows-msvc.exe'
Download-Asset -Url (Get-ReleaseAssetUrl -Release $release -Asset $agentAsset) -Asset $agentAsset -Dest $agentExe
Download-Asset -Url (Get-ReleaseAssetUrl -Release $release -Asset $captureAsset) -Asset $captureAsset -Dest $captureExe

if (-not $SkipTray) {
    $trayExe = Join-Path $BinDir 'lattice-tray.exe'
    $trayAsset = 'lattice-tray-x86_64-pc-windows-msvc.exe'
    Download-Asset -Url (Get-ReleaseAssetUrl -Release $release -Asset $trayAsset) -Asset $trayAsset -Dest $trayExe
}

Write-Host "`nWriting config ..."
if (-not (Test-Path $CfgFile)) {
    $hostname = $env:COMPUTERNAME
    $config = @"
[spine]
url         = "$SpineUrl"
agent_token = "$AgentToken"

[agent]
machine_id            = "$hostname"
poll_interval_minutes = 15
max_file_bytes        = 10485760

# Add directories to watch. Repeat [[agent.watch]] for each directory.
# [[agent.watch]]
# path     = "C:\Users\$env:USERNAME\Documents"
# patterns = ["**/*.md", "**/*.txt", "**/*.pdf"]
"@
    Set-Content -Path $CfgFile -Value $config -Encoding UTF8
    Write-Host "  Config written to: $CfgFile"
} else {
    Write-Host "  Config already exists, skipping: $CfgFile"
}

Write-Host "`nRegistering Task Scheduler tasks ..."
Register-LogonTask -TaskName 'LatticeAgent' -ExePath $agentExe

if (-not $SkipTray) {
    Register-LogonTask -TaskName 'LatticeTray' -ExePath $trayExe
}

Write-Host "`nDone! Edit your config at:"
Write-Host "  $CfgFile"
Write-Host ""
Write-Host "Then start the agent now with:"
Write-Host "  schtasks /Run /TN LatticeAgent"
if (-not $SkipTray) {
    Write-Host "  schtasks /Run /TN LatticeTray"
}

Write-Host ""
Write-Host "To bind a global hotkey for quick capture, either:"
Write-Host "  - Create a shortcut to '$captureExe --prompt' and set its 'Shortcut key' in Properties, or"
Write-Host "  - With AutoHotkey v2 installed, add this line to your AHK script:"
Write-Host "      ^!l::Run('`"$captureExe`" --prompt')"
Write-Host ""
Write-Host "Product update commands:"
Write-Host "  lattice-agent update check"
Write-Host "  lattice-agent update apply --all-supported"
Write-Host "  lattice-agent update history"
