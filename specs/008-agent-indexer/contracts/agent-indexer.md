# Contract: Agent Indexer

## Auth

All endpoints below are under `/api/agent/*` and require `Authorization: Bearer <LATTICE_AGENT_TOKEN>`. Missing or invalid bearer tokens return `401`.

## POST /api/agent/index

Indexes or updates one local file's extracted text.

### Request

```json
{
  "machine_id": "personal-laptop",
  "path": "/home/user/Documents/notes/foo.md",
  "hash": "blake3-hex-or-compatible-hash",
  "mime_type": "text/markdown",
  "text": "Extracted file text",
  "modified_at": "2026-05-26T19:00:00Z",
  "size_bytes": 1234
}
```

### Response

```json
{ "ok": true }
```

### Behavior

- Empty `machine_id`, `path`, `hash`, `mime_type`, or `modified_at` is invalid.
- Negative `size_bytes` is invalid.
- Reposting the same `machine_id + path + hash` is a no-op.
- Posting the same `machine_id + path` with a new hash updates stored text/metadata and replaces the old local-file index document.

## POST /api/agent/status

Reports latest local scan health.

### Request

```json
{
  "machine_id": "personal-laptop",
  "state": "idle",
  "last_scan_at": "2026-05-26T19:00:00Z",
  "last_indexed": 5,
  "last_skipped": 42,
  "last_errors": 0,
  "spine_ok": true,
  "last_error_msg": null
}
```

### Response

```json
{ "ok": true }
```

### Behavior

- `state` must be `idle`, `scanning`, or `error`.
- Counts must be non-negative integers.
- `last_scan_at` and `last_error_msg` may be null.
- Repeated reports from the same machine replace the previous status row.

## GET /api/status

Browser-authenticated status diagnostics include summarized agent status.

### Response Shape

```json
{
  "ready": true,
  "state": "ready",
  "checks": [],
  "agents": [
    {
      "machine_id": "personal-laptop",
      "state": "idle",
      "last_scan_at": "2026-05-26T19:00:00Z",
      "last_indexed": 5
    }
  ],
  "active_agent_count": 1
}
```

## Local Configuration

The agent reads a TOML config from the platform config directory.

```toml
[spine]
url = "https://lattice.example.com"
agent_token = "..."

[agent]
machine_id = "personal-laptop"
poll_interval_minutes = 15
max_file_bytes = 10485760

[[agent.watch]]
path = "~/Documents/notes"
patterns = ["**/*.md", "**/*.txt", "**/*.pdf"]
```

Required values for indexer operation are spine URL, agent token, at least one watch entry, and usable patterns. Machine id defaults to host name when omitted.
