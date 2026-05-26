# Contracts: Desktop Companions

## Quick Capture Spine Request

Reuses the existing bearer-token agent capture route.

```http
POST /api/agent/capture
Authorization: Bearer <agent_token>
Content-Type: application/json
```

Request body:

```json
{
  "text": "remember to check the invoice",
  "source": "desktop-hotkey",
  "captured_at": "2026-05-26T19:00:00Z"
}
```

Success response includes a numeric id and may include triage metadata used for user feedback:

```json
{
  "id": 123,
  "triage_action": null,
  "text": "remember to check the invoice"
}
```

Behavior:

- 2xx responses confirm delivery.
- Retryable network/server failures preserve the capture in the local queue.
- Permanent 4xx failures while draining may be removed from the queue with diagnostics.

## Local Capture Queue

Stored in the platform data directory as SQLite.

Required columns:

- `id`: local integer primary key
- `text`: capture text
- `source`: capture source label
- `captured_at`: original capture timestamp
- `queued_at`: local queue timestamp

Queue behavior:

- Drain in ascending `id` order.
- Delete a row after successful delivery.
- Preserve text and emit critical diagnostics if both spine delivery and queue write fail.

## Agent IPC Commands

Local companions send one UTF-8 command line and read one UTF-8 response line.

### `status`

Response:

```json
{
  "state": "idle",
  "last_scan_at": "2026-05-26T19:00:00Z",
  "last_indexed": 4,
  "last_skipped": 17,
  "last_errors": 0,
  "spine_ok": true,
  "last_error_msg": null
}
```

Allowed states are `idle`, `scanning`, and `error`; clients must tolerate unknown future values.

### `reindex`

Response:

```json
{ "ok": true }
```

If the agent is shutting down or unavailable, companions show a clear failure message.

## Configuration TOML

Required user-facing shape:

```toml
[spine]
url = "https://lattice.example.com"
agent_token = "replace-me"

[agent]
machine_id = "laptop"
poll_interval_minutes = 15
max_file_bytes = 10485760

[[agent.watch]]
path = "~/Documents"
patterns = ["**/*.md", "**/*.txt", "**/*.pdf"]
```

Config editor behavior:

- Load missing optional values with documented defaults.
- Preserve comments and unrelated formatting where possible.
- Save atomically through a temporary file and rename.
- Remove empty watch patterns instead of writing blank patterns.

## Service And Startup Contracts

Linux:

- Agent service: `lattice-agent.service`
- Tray service: `lattice-tray.service`
- User commands: `systemctl --user start|stop|restart lattice-agent`; `systemctl --user status lattice-tray`
- Logs: `journalctl --user -u lattice-agent -f`

Windows:

- Installed under `%LOCALAPPDATA%\lattice`
- Config under `%APPDATA%\lattice\config.toml`
- Scheduled tasks: `LatticeAgent`, `LatticeTray`
- Manual start commands: `schtasks /Run /TN LatticeAgent`, `schtasks /Run /TN LatticeTray`
