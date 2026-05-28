# Product Updates Accessibility Evidence

## Scope

This feature changes terminal, installer, service-log, notification, and update-history copy. No persistent desktop or web update controls were added, so WCAG 2.2 AA control evidence is not applicable for this slice.

## CLI Output Evidence

- Check-only output starts with `Product updates` and prints one plain-text line per product.
- Each product line includes product name, installed version or `unknown`, latest version or `unavailable`, status text, and a next action.
- Status is expressed in words such as `current`, `update available`, `manual update required`, `unsupported`, and `offline`; no color, symbol, spinner, icon, or transient notification is required to understand the result.
- Successful apply output names the restart action in text, including `systemctl --user restart lattice-agent` on Linux and Task Scheduler commands on Windows.
- Failed verification output records `failed-verification` in local history and explains that installed files were preserved when replacement had not started.
- Offline checks print a retry instruction and record the outcome without changing local files.
- Declined confirmation prints that no files were changed and exits with the documented confirmation code.
- Interrupted or failed installation recovery text tells the operator to rerun the update or reinstall from the release channel after correcting the issue.

## Installer And Service-Log Evidence

- Linux installer completion text now points operators to `lattice-agent update check`, `lattice-agent update apply --all-supported`, and `lattice-agent update history`.
- Windows installer completion text now points operators to the same commands in PowerShell form.
- Update messages are plain text and suitable for terminal capture or service logs.

## History Evidence

- `lattice-agent update history` prints recent attempts in reverse chronological order.
- Each row includes time, operation, product ids, starting version, target version or `unavailable`, outcome, and next action text.
- Empty history prints a direct instruction to run `lattice-agent update check`.

## Bilingual Delivery

Bilingual delivery is N/A for this feature because current Lattice installer, agent, and diagnostic copy is English-only and no translation resource or locale selection mechanism is in scope.
