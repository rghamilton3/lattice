# Agent Indexer Accessibility Evidence

**Feature**: Agent Indexer
**Date**: 2026-05-26
**Standard**: WCAG 2.2 AA where the feature is surfaced through user-facing docs,
terminal diagnostics, service logs, or status summaries.

## Scope

Affected artifacts are local agent foreground logs, systemd user journal output,
setup documentation, spine agent status diagnostics, and the `/api/status` agent
summary consumed by authenticated status surfaces.

## Evidence

- Diagnostics are emitted as plain text via `tracing`, so they are available in
  terminal output and `journalctl --user -u lattice-agent` without visual-only
  cues.
- Configuration failures use contextual errors that identify the unreadable or
  invalid config path before polling starts.
- Scan diagnostics name the relevant path, HTTP status, or extraction command
  failure so a user can act without relying on color or icons.
- Status payloads expose labeled fields (`state`, `last_scan_at`,
  `last_indexed`, `last_skipped`, `last_errors`, `spine_ok`,
  `last_error_msg`) for future UI/status surfaces.
- Documentation describes supported file types, skip behavior, force reindex,
  and service log inspection in text form.

## Bilingual Delivery

Bilingual delivery is N/A for this feature. The implementation adds English-only
operator diagnostics and documentation, but no translated UI copy or locale
switching surface. If agent status is later rendered in a localized UI, that UI
must provide translated labels and update this evidence.

## Follow-Up Triggers

Update this file if terminal output becomes interactive, if status diagnostics
are added to a visual UI, or if new extraction/setup flows introduce user-facing
copy beyond plain English diagnostics.
