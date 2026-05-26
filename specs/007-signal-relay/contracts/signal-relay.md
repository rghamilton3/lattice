# Contracts: Signal Relay

## Environment Contract

Required:

- `LATTICE_AGENT_TOKEN`: Bearer token accepted by spine agent routes.
- `SIGNAL_PHONE_NUMBER`: E.164 Signal number used for Note-to-Self filtering and replies.

Optional:

- `SIGNAL_RPC_HOST`: Signal JSON-RPC host/port, default `127.0.0.1:7583`.
- `SPINE_URL`: Capture endpoint, default `http://127.0.0.1:3000/api/agent/capture`.
- `SIGNAL_ATTACHMENTS_DIR`: Local/container path to signal-cli attachment files. When unset, text captures still work and attachments are not uploaded.
- `SIGNAL_RELAY_DEBUG=1`: Emit parser skip reasons to diagnostics.

Startup behavior:

- Missing token exits before connection.
- Missing phone number exits before connection.
- Missing attachment dir warns and continues in text-only mode.

## Signal RPC Input

The relay subscribes to Signal receive events over JSON-RPC. Accepted frames are either:

```json
{
  "method": "receive",
  "params": {
    "envelope": {
      "sourceNumber": "+15551234567",
      "timestamp": 1700000000000,
      "dataMessage": {
        "message": "capture text",
        "timestamp": 1700000000000,
        "attachments": []
      }
    }
  }
}
```

or Note-to-Self sync messages:

```json
{
  "method": "receive",
  "params": {
    "envelope": {
      "sourceNumber": "+15551234567",
      "syncMessage": {
        "sentMessage": {
          "destination": "+15551234567",
          "timestamp": 1700000000500,
          "message": "capture text",
          "attachments": []
        }
      }
    }
  }
}
```

Skipped frames:

- Wrong method
- Missing envelope
- Source number mismatch
- Sync message destination mismatch
- Missing payload
- Empty text with no attachments

## Capture Output

`POST {SPINE_URL}`

Headers:

- `Authorization: Bearer <LATTICE_AGENT_TOKEN>`
- `Content-Type: application/json`
- `X-Forwarded-Proto: https`

Body:

```json
{
  "text": "capture text",
  "source": "signal",
  "captured_at": "2026-05-26T19:00:00.000Z"
}
```

Expected success response:

```json
{
  "id": 123,
  "triage_action": null,
  "text": "capture text"
}
```

Failure handling:

- Non-2xx responses are logged.
- Attachments are not attempted when capture creation fails.

## Attachment Output

`POST {SPINE_BASE}/api/agent/capture/{captureId}/attachments`

Headers match capture output.

Body:

```json
{
  "signal_id": "signal-attachment-id",
  "content_type": "audio/aac",
  "filename": "voice.aac",
  "data": "<base64 bytes>",
  "size_bytes": 12345
}
```

Failure handling:

- Missing attachment id is skipped.
- Unsafe or unreadable local paths fail only that attachment.
- Non-2xx attachment responses are logged and do not delete the saved capture.

## Signal Acknowledgements

- Parsed messages receive best-effort observation reaction.
- Saved messages receive best-effort success reaction.
- Saved task/keep/other outcomes may receive concise text replies.
- Acknowledgement write failures are logged and do not change capture persistence.
