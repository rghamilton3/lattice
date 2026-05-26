# Accessibility Evidence: Desktop Companions

**Feature**: Desktop Companions
**Date**: 2026-05-26
**Standard**: WCAG 2.2 AA where local UI, notifications, prompts, service diagnostics, and documentation are user-facing

## Affected Surfaces

- Quick capture terminal output, prompt window, desktop notifications, and queue failure diagnostics.
- Linux and Windows tray menu labels, tooltips, and service-control failure messages.
- Configuration editor headings, labels, validation errors, save/restart/reindex prompts, and IPC failure messages.
- Linux installer prompts, Windows installer output, service/task commands, and setup documentation.

## Evidence

- Tray state is not color-only: status text includes labels such as `Agent stopped`, `Spine: reachable`, `Spine: unreachable`, `IPC error`, and `Last error`.
- Quick capture provides plain text confirmation or queued/lost-capture diagnostics in addition to desktop notifications.
- Configuration editing validates required spine URL/token and numeric limits before saving, with field-specific plain text errors.
- Reindex and restart failures name the failed local control path, such as `systemctl`, `schtasks`, or agent IPC connection errors.
- Documentation includes text commands for checking services, reading logs, invoking capture manually, and starting Windows scheduled tasks.

## Bilingual Rationale

Bilingual delivery is N/A for this phase. The feature adds English-only local desktop companion copy, installer prompts, and diagnostics, and does not introduce translated web UI or bilingual content surfaces.

## Follow-Up Triggers

- Add translated evidence if local companion UI copy becomes bilingual.
- Re-review labels if tray icons or notifications become the only state channel.
- Re-run evidence if companion flows move from local desktop UI into the web surface.
