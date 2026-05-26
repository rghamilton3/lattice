# Contract: Capture Inbox

All browser capture endpoints are under the Authentik-protected `/api/*` route group. Requests without valid Authentik forwarding evidence are denied by the shared guard before route handling.

## GET /api/captures

Returns recent captures.

### Query Parameters

- `limit` optional positive integer string; defaults to 50 and is capped at 200.
- `cursor` optional opaque pagination cursor from a previous response.
- `all` optional `1`; when omitted, only inbox-visible captures are returned.

### Response 200

```json
{
  "items": [
    {
      "id": 123,
      "text": "remember this",
      "source": "desktop-hotkey",
      "captured_at": "2026-05-26T15:00:00.000Z",
      "ingested_at": "2026-05-26T15:00:00.000Z",
      "triaged_at": null,
      "triage_action": null,
      "first_image_id": null
    }
  ],
  "next_cursor": null
}
```

### Errors

- `400`: Cursor is malformed or invalid.
- `401`/`403`: Authentication guard rejects the request.

## POST /api/captures

Creates a browser quick capture.

### Request Body

```json
{
  "text": "remember this",
  "source": "desktop-hotkey"
}
```

### Validation

- `text` must be non-empty after trimming.
- `text` must be at most 10,000 characters.
- `source` must be non-empty after trimming.

### Response 200

```json
{
  "id": 123,
  "triage_action": null,
  "text": "remember this"
}
```

### Errors

- `400` or `422`: Request body fails validation.
- `401`/`403`: Authentication guard rejects the request.

## GET /api/captures/stream

Streams newly created captures to open inbox views.

### Event: capture

```text
event: capture
data: {"id":123,"text":"remember this","source":"desktop-hotkey","captured_at":"2026-05-26T15:00:00.000Z","ingested_at":"2026-05-26T15:00:00.000Z","triaged_at":null,"triage_action":null,"first_image_id":null}
```

### Notes

- Sends keep-alive comments while connected.
- Same-instance only; no cross-process delivery guarantee.
- UI must remain usable if the stream disconnects.
