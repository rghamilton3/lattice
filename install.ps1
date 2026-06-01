<#
.SYNOPSIS
    Installs lattice-agent on Windows.

.DESCRIPTION
    Downloads the latest lattice-agent release binaries, installs them to
    %LOCALAPPDATA%\lattice\, writes a starter config to %APPDATA%\lattice\,
    and places two shortcuts in the current-user Startup folder:
      - LatticeAgent     : the background indexer
      - LatticeTray      : the system-tray monitor

.PARAMETER SpineUrl
    URL of your Lattice Spine instance (e.g. https://lattice.example.com).

.PARAMETER AgentToken
    Bearer token for the agent to authenticate with Spine.

.PARAMETER SkipTray
    Install the agent only; do not install or register the tray startup shortcut.

.PARAMETER Uninstall
    Remove the current user's installer-managed binaries, startup shortcuts, and legacy scheduled tasks.

.PARAMETER PurgeConfig
    With -Uninstall, also remove the installer-created configuration directory.

.EXAMPLE
    .\install.ps1 -SpineUrl https://lattice.example.com -AgentToken "abc123"
#>
[CmdletBinding()]
param(
    [string]$SpineUrl,

    [string]$AgentToken,

    [switch]$SkipTray,

    [switch]$Uninstall,

    [switch]$PurgeConfig
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

function Resolve-StartupShortcutPath {
    param([string]$StartupDir, [string]$ShortcutName)

    "$($StartupDir.TrimEnd('\'))\$ShortcutName.lnk"
}

function Resolve-WindowsParentPath {
    param([string]$Path)

    $lastSlash = $Path.LastIndexOf('\')
    if ($lastSlash -lt 0) {
        return ''
    }

    $Path.Substring(0, $lastSlash)
}

function ConvertTo-PowerShellSingleQuotedString {
    param([string]$Value)

    "'$($Value.Replace("'", "''"))'"
}

function Resolve-HiddenStartCommand {
    param([string]$FilePath, [string]$Arguments = '')

    $command = "Start-Process -WindowStyle Hidden -FilePath $(ConvertTo-PowerShellSingleQuotedString -Value $FilePath)"
    if (-not [string]::IsNullOrEmpty($Arguments)) {
        $command = "$command -ArgumentList $(ConvertTo-PowerShellSingleQuotedString -Value $Arguments)"
    }

    $command
}

function Resolve-ShortcutProperties {
    param([string]$ExePath, [string]$Arguments = '')

    $startCommand = Resolve-HiddenStartCommand -FilePath $ExePath -Arguments $Arguments
    @{
        TargetPath = 'powershell.exe'
        Arguments = "-NoProfile -WindowStyle Hidden -Command `"$startCommand`""
        WorkingDirectory = Resolve-WindowsParentPath -Path $ExePath
        WindowStyle = 7
    }
}

function Register-StartupShortcut {
    param([string]$ShortcutName, [string]$ExePath, [string]$Arguments = '')

    $startupDir = [Environment]::GetFolderPath('Startup')
    if ([string]::IsNullOrEmpty($startupDir)) {
        throw 'Could not resolve the Startup folder path.'
    }

    $shortcutPath = Resolve-StartupShortcutPath -StartupDir $startupDir -ShortcutName $ShortcutName
    $shortcutProperties = Resolve-ShortcutProperties -ExePath $ExePath -Arguments $Arguments

    Write-Host "  Creating or updating startup shortcut: $ShortcutName"
    $shell = New-Object -ComObject WScript.Shell
    $shortcut = $shell.CreateShortcut($shortcutPath)
    $shortcut.TargetPath = $shortcutProperties.TargetPath
    $shortcut.Arguments = $shortcutProperties.Arguments
    $shortcut.WorkingDirectory = $shortcutProperties.WorkingDirectory
    $shortcut.WindowStyle = $shortcutProperties.WindowStyle
    $shortcut.Save()
}

function Resolve-SchtasksEndArguments {
    param([string]$TaskName)

    @('/End', '/TN', $TaskName)
}

function Resolve-SchtasksDeleteArguments {
    param([string]$TaskName)

    @('/Delete', '/TN', $TaskName, '/F')
}

function Test-SchtasksMissingOutput {
    param([object]$Output)

    $text = ($Output | Out-String)
    $text -like '*cannot find*' -or $text -like '*does not exist*' -or $text -like '*not exist*'
}

function Test-SchtasksBenignStopOutput {
    param([object]$Output)

    $text = ($Output | Out-String)
    (Test-SchtasksMissingOutput -Output $Output) -or $text -like '*not currently running*' -or $text -like '*has not been run*'
}

function Format-UninstallFailureMessage {
    param(
        [string]$Component,
        [string]$Identifier,
        [object]$Reason,
        [string]$NextAction
    )

    "$Component ($Identifier): $Reason Next action: $NextAction"
}

$script:UninstallRemoved = @()
$script:UninstallPreserved = @()
$script:UninstallSkipped = @()
$script:UninstallFailed = @()
$script:UninstallNextActions = @()

function Add-UninstallRemoved { param([string]$Message) $script:UninstallRemoved += $Message }
function Add-UninstallPreserved { param([string]$Message) $script:UninstallPreserved += $Message }
function Add-UninstallSkipped { param([string]$Message) $script:UninstallSkipped += $Message }
function Add-UninstallFailed {
    param([string]$Message, [string]$NextAction)

    $script:UninstallFailed += $Message
    $script:UninstallNextActions += $NextAction
}

function Write-UninstallSection {
    param([string]$Title, [string[]]$Items)

    Write-Host "${Title}:"
    if ($Items.Count -eq 0) {
        Write-Host '  None'
        return
    }

    foreach ($item in $Items) {
        Write-Host "  - $item"
    }
}

function Write-UninstallSummary {
    Write-Host ''
    Write-Host 'Uninstall summary'
    Write-Host '-----------------'
    Write-UninstallSection -Title 'Removed' -Items $script:UninstallRemoved
    Write-UninstallSection -Title 'Preserved' -Items $script:UninstallPreserved
    Write-UninstallSection -Title 'Skipped' -Items $script:UninstallSkipped
    Write-UninstallSection -Title 'Failed' -Items $script:UninstallFailed
    Write-UninstallSection -Title 'Next actions' -Items $script:UninstallNextActions
}

function Remove-InstallerPath {
    param([string]$Name, [string]$Path, [string]$NextAction)

    if (-not (Test-Path -LiteralPath $Path)) {
        Add-UninstallSkipped "$Name`: already absent at $Path"
        return
    }

    try {
        Remove-Item -LiteralPath $Path -Recurse -Force -ErrorAction Stop
        Add-UninstallRemoved "$Name`: $Path"
    } catch {
        $message = Format-UninstallFailureMessage -Component $Name -Identifier $Path -Reason $_.Exception.Message -NextAction $NextAction
        Add-UninstallFailed $message $NextAction
    }
}

function Remove-InstallerScheduledTask {
    param([string]$TaskName)

    $endArgs = Resolve-SchtasksEndArguments -TaskName $TaskName
    try {
        $output = & schtasks.exe @endArgs 2>&1
        if ($LASTEXITCODE -ne 0 -and -not (Test-SchtasksBenignStopOutput -Output $output)) {
            $nextAction = "Close related Lattice processes, then rerun uninstall or stop scheduled task $TaskName manually."
            $message = Format-UninstallFailureMessage -Component 'scheduled task stop' -Identifier $TaskName -Reason $output -NextAction $nextAction
            Add-UninstallFailed $message $nextAction
        }
    } catch {
        $nextAction = "Rerun uninstall on Windows or stop scheduled task $TaskName manually."
        $message = Format-UninstallFailureMessage -Component 'scheduled task stop' -Identifier $TaskName -Reason $_.Exception.Message -NextAction $nextAction
        Add-UninstallFailed $message $nextAction
    }

    $deleteArgs = Resolve-SchtasksDeleteArguments -TaskName $TaskName
    try {
        $output = & schtasks.exe @deleteArgs 2>&1
    } catch {
        $nextAction = "Rerun uninstall on Windows or delete scheduled task $TaskName manually."
        $message = Format-UninstallFailureMessage -Component 'scheduled task' -Identifier $TaskName -Reason $_.Exception.Message -NextAction $nextAction
        Add-UninstallFailed $message $nextAction
        return
    }
    if ($LASTEXITCODE -eq 0) {
        Add-UninstallRemoved "scheduled task $TaskName"
        return
    }

    if (Test-SchtasksMissingOutput -Output $output) {
        Add-UninstallSkipped "scheduled task $TaskName`: already absent"
        return
    }

    $nextAction = "Close related Lattice processes, then rerun uninstall or delete scheduled task $TaskName manually."
    $message = Format-UninstallFailureMessage -Component 'scheduled task' -Identifier $TaskName -Reason $output -NextAction $nextAction
    Add-UninstallFailed $message $nextAction
}

function Invoke-LatticeUninstall {
    param([string]$BinDir, [string]$CfgDir, [switch]$PurgeConfig)

    Write-Host 'Uninstalling Lattice local user installation'

    Remove-InstallerScheduledTask -TaskName 'LatticeAgent'
    Remove-InstallerScheduledTask -TaskName 'LatticeTray'

    $startupDir = [Environment]::GetFolderPath('Startup')
    if (-not [string]::IsNullOrEmpty($startupDir)) {
        Remove-InstallerPath -Name 'startup shortcut LatticeAgent' -Path (Resolve-StartupShortcutPath -StartupDir $startupDir -ShortcutName 'LatticeAgent') -NextAction 'Remove the Startup folder shortcut manually.'
        Remove-InstallerPath -Name 'startup shortcut LatticeTray' -Path (Resolve-StartupShortcutPath -StartupDir $startupDir -ShortcutName 'LatticeTray') -NextAction 'Remove the Startup folder shortcut manually.'
    }

    Remove-InstallerPath -Name 'lattice-agent binary' -Path (Join-Path $BinDir 'lattice-agent.exe') -NextAction 'Close running lattice-agent processes and remove the file manually.'
    Remove-InstallerPath -Name 'lattice-capture binary' -Path (Join-Path $BinDir 'lattice-capture.exe') -NextAction 'Close running lattice-capture processes and remove the file manually.'
    Remove-InstallerPath -Name 'lattice-tray binary' -Path (Join-Path $BinDir 'lattice-tray.exe') -NextAction 'Close running lattice-tray processes and remove the file manually.'

    if ($PurgeConfig) {
        Remove-InstallerPath -Name 'Lattice configuration' -Path $CfgDir -NextAction 'Check permissions or remove the configuration directory manually.'
    } elseif (Test-Path -LiteralPath $CfgDir) {
        Add-UninstallPreserved "Lattice configuration: $CfgDir"
        $script:UninstallNextActions += 'To remove preserved configuration, rerun with -Uninstall -PurgeConfig.'
    } else {
        Add-UninstallSkipped "Lattice configuration: already absent at $CfgDir"
    }

    Write-UninstallSummary
    return ($script:UninstallFailed.Count -eq 0)
}

if ($env:LATTICE_INSTALLER_IMPORT_ONLY -eq '1') {
    return
}

$BinDir  = Join-Path $env:LOCALAPPDATA 'lattice'
$CfgDir  = Join-Path $env:APPDATA      'lattice'
$CfgFile = Join-Path $CfgDir           'config.toml'

if ($Uninstall) {
    $ok = Invoke-LatticeUninstall -BinDir $BinDir -CfgDir $CfgDir -PurgeConfig:$PurgeConfig
    if (-not $ok) {
        exit 1
    }
    exit 0
}

if ($PurgeConfig) {
    throw 'PurgeConfig requires -Uninstall.'
}

if ([string]::IsNullOrWhiteSpace($SpineUrl)) {
    throw 'SpineUrl is required for install mode. Use -Uninstall to remove an existing installation.'
}

if ([string]::IsNullOrWhiteSpace($AgentToken)) {
    throw 'AgentToken is required for install mode. Use -Uninstall to remove an existing installation.'
}

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

Write-Host "`nRegistering startup shortcuts ..."
Register-StartupShortcut -ShortcutName 'LatticeAgent' -ExePath $agentExe

if (-not $SkipTray) {
    Register-StartupShortcut -ShortcutName 'LatticeTray' -ExePath $trayExe
}

Write-Host "`nDone! Edit your config at:"
Write-Host "  $CfgFile"
Write-Host ""
Write-Host "Then start the agent now with:"
Write-Host "  $(Resolve-HiddenStartCommand -FilePath $agentExe)"
if (-not $SkipTray) {
    Write-Host "  $(Resolve-HiddenStartCommand -FilePath $trayExe)"
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
