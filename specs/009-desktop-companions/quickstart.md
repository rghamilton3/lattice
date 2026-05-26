# Quickstart: Desktop Companions

## Linux Install Flow

```bash
bash <(curl -fsSL https://raw.githubusercontent.com/rghamilton3/lattice/main/install.sh)
```

Verify service state and logs:

```bash
systemctl --user status lattice-agent
systemctl --user status lattice-tray
journalctl --user -u lattice-agent -f
```

Run quick capture manually:

```bash
lattice-capture "remember the invoice"
echo "captured from pipe" | lattice-capture
lattice-capture --prompt
```

## Windows Install Flow

```powershell
iwr https://raw.githubusercontent.com/rghamilton3/lattice/main/install.ps1 -OutFile install.ps1
.\install.ps1 -SpineUrl https://lattice.example.com -AgentToken "<token>"
schtasks /Run /TN LatticeAgent
schtasks /Run /TN LatticeTray
```

Bind a hotkey through a shortcut to `lattice-capture.exe --prompt` or AutoHotkey as documented in `README.md`.

## Local Development Checks

```bash
cd agent
cargo test
cargo test --features gui
cargo build --bin lattice-agent
cargo build --features gui --bin lattice-capture --bin lattice-config
```

Linux tray build:

```bash
cd agent
cargo build --bin lattice-tray
```

Script sanity checks:

```bash
bash -n install.sh
pwsh -NoProfile -Command "$tokens=$null; $errors=$null; [System.Management.Automation.Language.Parser]::ParseFile('install.ps1',[ref]$tokens,[ref]$errors) | Out-Null; if ($errors) { $errors; exit 1 }"
```

If PowerShell is unavailable on the development machine, review `install.ps1` manually and rely on Windows CI/manual validation.

## Accessibility Notes

- Tray menu items and notifications must include text labels; icon color alone is not sufficient.
- Capture failure paths must print recoverable text or queue status in plain text logs/notifications.
- Configuration editor errors must name the failing field or file path.
- Bilingual delivery remains N/A for this phase because local companion UI and installer copy are English-only and no translated surface is introduced.
