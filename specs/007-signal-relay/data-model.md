# Data Model: Signal Relay

## Signal Frame

- `method`: JSON-RPC method; only `receive` is accepted.
- `params.envelope.sourceNumber`: Must match configured Signal phone number.
- `params.envelope.timestamp`: Fallback original send timestamp in Unix milliseconds.
- `params.envelope.dataMessage`: Incoming message payload shape.
- `params.envelope.syncMessage.sentMessage`: Note-to-Self sent payload shape.
- `sentMessage.destination`: Must match configured Signal phone number for sync messages.

## Relay Capture

- `text`: Trimmed message text, or placeholder text for attachment-only messages.
- `source`: Always `signal`.
- `captured_at`: ISO timestamp derived from payload timestamp, envelope timestamp, or current time fallback.
- `sourceNumber`: Raw Signal source number used for reaction targeting.
- `sourceTimestamp`: Raw Signal Unix-ms timestamp used for reaction targeting.

Validation:

- Empty text with no attachments is skipped.
- Non-self sends are skipped.
- Malformed or unsupported frames are skipped.

## Signal Attachment

- `id`: Signal attachment file identifier; required for upload.
- `contentType`: MIME type; defaults to `application/octet-stream` when absent.
- `filename`: Optional user-facing filename; empty string when absent.
- `size`: Optional Signal-reported byte count.
- `resolvedPath`: Canonical local path under configured attachment directory.
- `data`: Base64-encoded bytes sent to the existing agent attachment endpoint.

Validation:

- Missing `id` is skipped with a warning.
- Resolved path must remain inside configured attachment directory.
- Read failures are logged per attachment and do not roll back the capture.

## Relay Connection State

- `activeSocket`: Current Signal RPC socket, or null.
- `connecting`: Boolean guard while a connection attempt is in flight.
- `reconnectTimer`: Pending reconnect timer, or null.
- `backoff`: Current retry delay, starting at 1 second and capped at 60 seconds.

State rules:

- At most one of active socket, connection attempt, or reconnect timer should drive future connection work.
- Duplicate failure callbacks must collapse into a single reconnect timer.
- Successful connection resets backoff.
