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
$BinDir  = Join-Path $env:LOCALAPPDATA 'lattice'
$CfgDir  = Join-Path $env:APPDATA      'lattice'
$CfgFile = Join-Path $CfgDir           'config.toml'

# ── Helpers ───────────────────────────────────────────────────────────────────

function Get-LatestTag {
    $api = "https://api.github.com/repos/$Repo/releases/latest"
    (Invoke-RestMethod -Uri $api -Headers @{ 'User-Agent' = 'lattice-installer' }).tag_name
}

function Download-Asset {
    param([string]$Tag, [string]$Asset, [string]$Dest)
    $url = "https://github.com/$Repo/releases/download/$Tag/$Asset"
    Write-Host "  Downloading $Asset ..."
    Invoke-WebRequest -Uri $url -OutFile $Dest -UseBasicParsing
}

function Register-LogonTask {
    param([string]$TaskName, [string]$ExePath, [string]$Arguments = '')
    $trigger  = New-ScheduledTaskTrigger -AtLogon
    $settings = New-ScheduledTaskSettingsSet -ExecutionTimeLimit 0 -RestartCount 3 -RestartInterval (New-TimeSpan -Minutes 1)
    $action   = New-ScheduledTaskAction -Execute $ExePath -Argument $Arguments
    $principal = New-ScheduledTaskPrincipal -UserId "$env:USERDOMAIN\$env:USERNAME" -LogonType Interactive -RunLevel Limited

    $existing = Get-ScheduledTask -TaskName $TaskName -ErrorAction SilentlyContinue
    if ($existing) {
        Write-Host "  Updating existing task: $TaskName"
        Set-ScheduledTask -TaskName $TaskName -Action $action -Trigger $trigger -Settings $settings -Principal $principal | Out-Null
    } else {
        Write-Host "  Creating task: $TaskName"
        Register-ScheduledTask -TaskName $TaskName -Action $action -Trigger $trigger -Settings $settings -Principal $principal | Out-Null
    }
}

# ── Install ───────────────────────────────────────────────────────────────────

Write-Host "Lattice Agent installer"
Write-Host "========================"

Write-Host "`nFetching latest release tag ..."
$tag = Get-LatestTag
Write-Host "  Tag: $tag"

Write-Host "`nCreating install directories ..."
New-Item -ItemType Directory -Force -Path $BinDir | Out-Null
New-Item -ItemType Directory -Force -Path $CfgDir | Out-Null

Write-Host "`nDownloading binaries ..."
$agentExe  = Join-Path $BinDir 'lattice-agent.exe'
$captureExe = Join-Path $BinDir 'lattice-capture.exe'
Download-Asset -Tag $tag -Asset 'lattice-agent-x86_64-pc-windows-msvc.exe'  -Dest $agentExe
Download-Asset -Tag $tag -Asset 'lattice-capture-x86_64-pc-windows-msvc.exe' -Dest $captureExe

if (-not $SkipTray) {
    $trayExe = Join-Path $BinDir 'lattice-tray.exe'
    Download-Asset -Tag $tag -Asset 'lattice-tray-x86_64-pc-windows-msvc.exe' -Dest $trayExe
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
