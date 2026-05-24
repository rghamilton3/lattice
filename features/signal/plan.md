> BACKFILLED ARTIFACT
> Reverse-engineered from `spine/src/signal/` and `spine/src/signal-relay.ts` on 2026-05-23.
> This is NOT the original intent of the feature; it is an inferred
> description based on code inspection. Treat as documentation, not spec.

# Plan: Signal Capture Integration

## 1. Architecture As-Is

```
signal-cli (TCP JSON-RPC)
    |
    v
signal-relay.ts (process)
    +-- parseSignalMessage()  [signal/messages.ts]
    +-- sendReply()           [signal-relay.ts]
    +-- sendReaction()        [signal-relay.ts]
    +-- upload attachments    -> spine /api/captures/:id/attachments
    +-- POST capture          -> spine /api/agent/capture
```

`signal-relay.ts` is a standalone Bun process (not imported by spine). It is
started separately and communicates with spine over HTTP.

## 2. Data Model

No database schema owned by this module. It writes to spine via HTTP.

Parsed message shape (`ParsedSignalMessage`):
- `captureText: string` - message body or placeholder for attachment-only
- `capturedAt: string` - ISO timestamp (original send time)
- `attachments: SignalAttachment[]` - array with contentType, filename, size, id
- `sourceNumber: string` - Signal phone number (always equals `SIGNAL_PHONE_NUMBER`)
- `sourceTimestamp: number` - Unix-ms timestamp for reaction targeting

## 3. API Contracts

Consumes (outbound from relay):
- `POST /api/agent/capture` body: `{ text, source: "signal", captured_at }`
- `POST /api/captures/:id/attachments` multipart with file from `SIGNAL_ATTACHMENTS_DIR`

Produces (to signal-cli via TCP):
- `send` method: text reply confirming capture ID
- `sendReaction` method: emoji reaction on original message timestamp

## 4. Dependencies

- `signal-cli` process (external, must be running and reachable at `SIGNAL_RPC_HOST`)
- Spine HTTP server at `SPINE_URL`
- `SIGNAL_ATTACHMENTS_DIR` local filesystem directory for attachment files from signal-cli
- `Bun.connect()` TCP API

## 5. Known Technical Debt

- Logging uses `console.error` / `console.warn` — no structured logger, no log levels.
- `backoff` variable is module-level; multiple relay processes would not be safe.
- No retry queue for failed spine POSTs — message captured on 👀 reaction but not resent on
  spine failure.
- `SPINE_BASE` is derived by regex-stripping the path suffix from `SPINE_URL`; fragile if the
  capture URL changes.
