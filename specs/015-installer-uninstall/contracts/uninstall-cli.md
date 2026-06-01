# Contract: Installer Uninstall CLI

## Linux Installer

### Default Install

```bash
./install.sh
```

**Expected behavior**: Existing install flow remains unchanged.

### Default Uninstall

```bash
./install.sh --uninstall
```

**Expected behavior**:

- Does not contact the network.
- Stops/disables/removes installer-managed user service entries where present.
- Removes installer-managed executable artifacts from the user install directory where present.
- Preserves user configuration by default.
- Prints a final plain-text summary with removed, preserved, skipped, and failed items.
- Exits successfully when the installation is already absent and no blocking removal failures occur.

### Complete Removal

```bash
./install.sh --uninstall --purge-config
```

**Expected behavior**:

- Performs default uninstall behavior.
- Removes installer-created configuration locations only because the user explicitly requested purge.
- Prints a clear warning or summary indicating configuration removal.

## Windows Installer

### Default Install

```powershell
.\install.ps1 -SpineUrl https://lattice.example.com -AgentToken "<token>"
```

**Expected behavior**: Existing install flow remains unchanged.

### Default Uninstall

```powershell
.\install.ps1 -Uninstall
```

**Expected behavior**:

- Does not require `-SpineUrl` or `-AgentToken`.
- Does not contact the network.
- Stops or unregisters installer-managed scheduled tasks where present.
- Removes installer-managed executable artifacts from the user install directory where present.
- Preserves user configuration by default.
- Prints a final plain-text summary with removed, preserved, skipped, and failed items.
- Exits successfully when the installation is already absent and no blocking removal failures occur.

### Complete Removal

```powershell
.\install.ps1 -Uninstall -PurgeConfig
```

**Expected behavior**:

- Performs default uninstall behavior.
- Removes installer-created configuration locations only because the user explicitly requested purge.
- Prints a clear warning or summary indicating configuration removal.

## Output Contract

Uninstall output must communicate these categories in plain text:

- Removed components.
- Preserved configuration paths.
- Skipped missing or not-installed components.
- Failed components and next actions.

Output must not rely on color, icons, glyph-only symbols, animation, or terminal-specific formatting for meaning.

## Error Contract

When a component cannot be removed, the failure message must include:

- Component name.
- Path or registration identifier when available.
- Reason reported by the platform command when available.
- Next action, such as closing a running process, rerunning from an appropriate shell, or removing the listed path manually.
