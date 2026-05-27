# Contract: Phase 0 Capture Paths

All Phase 0 capture paths converge on `POST /api/agent/track`. The command path determines `displaced`; free-form text is not parsed to infer state.

## HA Voice: Printing-Room Atom Echo

### Normal Track Phrase

- Phrase: `track {content}`
- Payload:

```json
{
  "text": "{content}",
  "source": "ha-voice:printing-room",
  "displaced": false,
  "captured_at": "<HA now ISO timestamp>"
}
```

### Checkout Phrase

- Phrase: `check out {content}`
- Payload differs only by `displaced: true`.

### Verification

- A normal phrase creates a searchable non-displaced record within 5 seconds.
- A checkout phrase creates a searchable displaced record within 5 seconds.
- If a phrase collides with another intent, fallback phrases are documented and tested.

## Tasker Phone Voice

### Normal Track Task

- Assistant phrase: `OK Google, run track in Tasker with {content}`
- Payload:

```json
{
  "text": "{content}",
  "source": "tasker-voice",
  "displaced": false,
  "captured_at": "<Tasker/phone timestamp>"
}
```

### Checkout Task

- Assistant phrase: `OK Google, run checkout in Tasker with {content}`
- Payload differs only by `displaced: true`.

### Verification

- Both tasks create searchable records within 10 seconds under normal connectivity.
- TV or other household assistant interception fails verification; phone must receive the command.

## Signal Text

### Normal Track Command

- Message: `/track {content}`
- Payload:

```json
{
  "text": "{content}",
  "source": "signal-text",
  "displaced": false,
  "captured_at": "<message timestamp or relay receive timestamp>"
}
```

### Checkout Command

- Message: `/checkout {content}`
- Payload differs only by `displaced: true`.

### Routing Rule

- `/track` and `/checkout` route to tracking.
- Existing `/capture`, `/url`, or other non-tracking commands continue routing unchanged.

## Signal Photo

### Command

- Photo message with caption `/track {content}` or `/checkout {content}`.

### Payload

```json
{
  "text": "{caption content}",
  "source": "signal-photo",
  "displaced": false,
  "captured_at": "<message timestamp or relay receive timestamp>",
  "photo_ref": "<stored photo reference>"
}
```

### Verification

- Caption text is searchable.
- `photo_ref` is present only when a usable image was actually stored.

## Shared Failure Rules

- Blank content is rejected and does not create a record.
- Missing source is rejected.
- Capture path errors should be observable in setup validation without requiring raw database inspection.
