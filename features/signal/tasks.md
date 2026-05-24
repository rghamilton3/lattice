> BACKFILLED ARTIFACT
> Reverse-engineered from `spine/src/signal/` and `spine/src/signal-relay.ts` on 2026-05-23.
> This is NOT the original intent of the feature; it is an inferred
> description based on code inspection. Treat as documentation, not spec.

# Tasks: Signal Capture Integration

All tasks represent shipped components. All marked [x].

- [x] T001 — ParsedSignalMessage type and SignalAttachment type — `spine/src/signal/messages.ts`
- [x] T002 — parseSignalMessage() pure function (dataMessage + syncMessage/sentMessage shapes) — `spine/src/signal/messages.ts`
- [x] T003 — isRpcError() helper — `spine/src/signal/messages.ts`
- [x] T004 — placeholderText() for attachment-only messages — `spine/src/signal/messages.ts`
- [x] T005 — ParseSkipReason type + ParseDebugHook interface — `spine/src/signal/messages.ts`
- [x] T006 — signal-relay.ts TCP socket state machine (connect / reconnect / backoff) — `spine/src/signal-relay.ts`
- [x] T007 — sendReply() JSON-RPC send method — `spine/src/signal-relay.ts`
- [x] T008 — sendReaction() emoji reaction (👀 / ✅) — `spine/src/signal-relay.ts`
- [x] T009 — Capture POST to spine /api/agent/capture — `spine/src/signal-relay.ts`
- [x] T010 — Attachment upload to spine /api/captures/:id/attachments — `spine/src/signal-relay.ts`
- [x] T011 — Wrong-destination filter for Note-to-Self sync messages — `spine/src/signal/messages.ts`
- [x] T012 — Unit tests for parseSignalMessage() — `spine/tests/unit/signal-messages.test.ts`
