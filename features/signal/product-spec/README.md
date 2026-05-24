> BACKFILLED ARTIFACT
> Reverse-engineered from `spine/src/signal/` and `spine/src/signal-relay.ts` on 2026-05-23.
> This is NOT the original intent of the feature; it is an inferred
> description based on code inspection. Treat as documentation, not spec.

# Signal Capture Integration

## 1. Feature Summary

The Signal integration bridges the signal-cli JSON-RPC stream and Lattice spine. A long-running
relay process (`signal-relay.ts`) connects to signal-cli via TCP, listens for incoming messages,
and forwards Note-to-Self messages (and direct messages from the configured phone number) to
spine's `/api/agent/capture` endpoint. On ingestion it sends emoji reactions back via signal-cli
so the user gets immediate confirmation in Signal: 👀 = relay parsed it, ✅ = spine saved it.

## 2. Target Users

Primary: a single self-hosted user who wants to capture thoughts and links from their phone via
Signal Note-to-Self without opening the Lattice surface.

## 3. Primary User Stories

- As a user, I can send a message to myself in Signal and have it appear in the Lattice inbox
  within seconds.
- As a user, I receive a 👀 reaction when the relay receives my message, and ✅ when spine
  persists it, so I know capture succeeded without opening a browser.
- As a user, I can attach files to a Signal Note-to-Self and have them stored in Lattice as
  capture attachments.
- As a user, voice notes and unnamed attachments appear as placeholder text so they are not
  silently dropped.

## 4. In-Scope / Out-of-Scope

**In scope (observed):**
- Connecting to signal-cli via TCP JSON-RPC (host:port configurable via `SIGNAL_RPC_HOST`).
- Parsing `receive` method frames for both `dataMessage` (direct) and `syncMessage.sentMessage`
  (Note-to-Self) shapes.
- Filtering to only the configured `SIGNAL_PHONE_NUMBER` to avoid capturing group messages.
- Uploading Signal attachments from a local directory to spine's attachment endpoint.
- Sending `sendReaction` and `send` reply frames back to signal-cli.
- Exponential backoff reconnection with a state machine (at most one of: activeSocket /
  connecting / reconnectTimer active at once).

**Out-of-scope (not observed in code):**
- Group chats or multi-device sync beyond Note-to-Self.
- Message editing or deletion events.
- Rich media transcription (voice notes become `[voice note]` placeholder).

## 5. Non-Functional Reality

- **Auth**: `LATTICE_AGENT_TOKEN` bearer token sent on every POST to spine. Fails fast at startup
  if unset.
- **Reliability**: State-machine prevents parallel reconnect loops (the prior bug exhausted
  ephemeral ports). Backpressure detected on `write()` return value; reply dropped with a warning.
- **Error handling**: RPC errors logged; attachment upload failures logged but do not abort the
  capture POST.
- **No rate limiting** on spine POSTs; relies on spine's own concurrency handling.
- **Logging**: `console.error` / `console.warn` — no structured logger.

## 6. Open Questions

- NEEDS-CLARIFICATION: Should group messages ever be captured, or is Note-to-Self the permanent
  design intent?
- NEEDS-CLARIFICATION: What is the intended behavior when signal-cli is offline for an extended
  period — is message loss acceptable?
- NEEDS-CLARIFICATION: Is there a maximum attachment size limit negotiated before upload?
- NEEDS-CLARIFICATION: The `wrong-destination` skip path silently discards outgoing messages to
  other contacts. Is this the desired behavior or should it be configurable?
