# Contract: Product Update CLI

The update mechanism is exposed first through local agent/installer commands. Exact command names may be finalized during implementation, but behavior must satisfy this contract.

## Check-Only Status

```bash
lattice-agent update check
```

Behavior:

- Detect installed Lattice products on the local machine.
- Fetch release metadata when reachable.
- Print one plain-text row or block per recognized product.
- Do not replace files, restart services, or modify config/queues/caches.
- Record an update attempt with operation `check`.

Required product fields in output:

- Product name
- Installed version or `unknown`
- Latest available version or `unavailable`
- Status: `current`, `update available`, `manual update required`, `unsupported`, `offline`, or `unknown`
- Next action in plain language

Example output:

```text
Product updates
lattice-agent: installed 0.10.0, latest 0.11.0, update available. Run `lattice-agent update apply lattice-agent` to update.
lattice-capture: installed 0.10.0, latest 0.11.0, update available with lattice-agent.
spine: installed unknown, automatic update unsupported. Update the self-hosted deployment manually from the project release notes.
```

## Apply Update

```bash
lattice-agent update apply lattice-agent
lattice-agent update apply desktop-companions
lattice-agent update apply --all-supported
```

Behavior:

- Require explicit operator action before replacing installed files.
- Show affected products, installed versions, target versions, and high-level summary when available.
- Stage artifacts under the local Lattice data directory.
- Verify staged artifacts before replacement.
- Preserve config, queue, cache, history, and user-created data.
- Restart affected services or print restart instructions when service control is unavailable.
- Record an update attempt with operation `apply`.

Apply must refuse to continue when:

- Metadata cannot identify a matching artifact for the current platform.
- Verification fails.
- The target product is not automatic-update capable.
- User state would be overwritten without explicit confirmation.

## History

```bash
lattice-agent update history
```

Behavior:

- Print recent update attempts in reverse chronological order.
- Include product, starting version, target version, outcome, time, and next action.
- Use plain text that remains understandable without color.

Example output:

```text
2026-05-27T15:30:00Z apply lattice-agent 0.10.0 -> 0.11.0: success. Restarted lattice-agent service.
2026-05-27T15:20:00Z check lattice-config unknown -> unavailable: offline. Try again when release metadata is reachable.
```

## Exit Codes

- `0`: command completed and any requested supported update succeeded or no update was needed
- `1`: command failed due to verification, installation, state-preservation, or unexpected local error
- `2`: update metadata was unreachable or offline
- `3`: requested product is unsupported for automatic update
- `4`: operator confirmation was declined or required input was missing

## Accessibility Requirements

- Output must identify product, outcome, and next action in text.
- Color, symbols, progress spinners, desktop notifications, or tray icons cannot be the only status signal.
- Failure output must be durable in terminal output and service logs.
