# Modification: Signal Relay - Notification Posture

**Status**: Active
**Created**: 2026-06-11
**Original Feature**: `specs/007-signal-relay/spec.md`
**Prior Modification**: `specs/007-signal-relay/modifications/001-signal-task-list/`
**Impact Analysis**: `impact-analysis.md`

---

## Modification Summary

**What We're Changing**: Gate all Signal relay text replies behind a `SIGNAL_NOTIFICATION_POSTURE`
toggle (quiet / standard / active). Add pings for failed and degraded-extraction cases that are
currently silent. Add a reply for `promote`-classified captures. Explicitly do not ping on
resurfacing.

**Why We're Changing It**:
- The relay currently replies unconditionally; operators need a way to silence it.
- Attachment failures and capture-post errors are currently silent on Signal - the operator only
  learns about them from spine logs, not from their phone.
- The `promote` triage action is never acknowledged; the user sent something that may need
  follow-up and receives no feedback.
- Resurfacing is a background curation pass; it needs no Signal notification loop.

---

## Current State

**Current Behavior**:
- `postCapture` always calls `sendReply`:
  - `task` → "Task queued: {text}"
  - `keep` → "Note saved: {text}"
  - `skip` → silent (correct, keep)
  - `promote` → silent (bug of omission)
  - null/other → "✓ #{id}"
- Capture-post HTTP errors: console.error only, no Signal reply
- Attachment upload errors: console.error only, no Signal reply
- Resurfacing: no Signal involvement

**Current Limitations**:
- No way to reduce Signal noise from the relay.
- Operators do not learn about failures on their phone.
- `promote` captures produce no feedback.

---

## Proposed Changes

### F001: Add `SIGNAL_NOTIFICATION_POSTURE` env var and posture helpers

**Current**: No Signal-specific posture config.

**Proposed**: Add `SIGNAL_NOTIFICATION_POSTURE` (quiet / standard / active, default `standard`),
mirroring the existing `ARCHIVE_NOTIFICATION_POSTURE` pattern in `archiveEvents.ts`.

New exports in `signal-relay.ts`:

```typescript
import type { NotificationPosture } from './archiveEvents';

export type SignalReplyEvent = 'failure' | 'classifier' | 'fallback';

export function signalNotificationPosture(): NotificationPosture {
    const v = process.env.SIGNAL_NOTIFICATION_POSTURE;
    return v === 'quiet' || v === 'standard' || v === 'active' ? v : 'standard';
}

export function shouldSendSignalReply(
    posture: NotificationPosture,
    event: SignalReplyEvent,
): boolean {
    if (posture === 'quiet') return false;
    if (event === 'fallback') return posture === 'active';
    return true;
}
```

Posture table:

| Signal reply event | quiet | standard | active |
|--------------------|-------|----------|--------|
| `failure` (capture or attachment error) | ✗ | ✓ | ✓ |
| `classifier` (task / keep / promote) | ✗ | ✓ | ✓ |
| `fallback` (unclassified "✓ #{id}") | ✗ | ✗ | ✓ |
| resurfacing | ✗ | ✗ | ✗ (by design) |
| `/task` command failure (interactive) | ✓ | ✓ | ✓ (not gated - user-initiated) |

**Breaking**: No. Default `standard` is the intended production baseline.

---

### F002: Gate `postCapture` replies by posture; add `promote` reply

**Current**: `postCapture` always calls `sendReply` for task/keep/null cases.

**Proposed**: Wrap every `sendReply` call with the posture predicate. Add `options.notificationPosture`
to `PostMessageOptions` for test injection (falls back to `signalNotificationPosture()`).

```typescript
const posture = options.notificationPosture ?? signalNotificationPosture();

if (result.triage_action === 'task') {
    if (shouldSendSignalReply(posture, 'classifier'))
        sendReply(`Task queued: ${result.text}`);
} else if (result.triage_action === 'keep') {
    if (shouldSendSignalReply(posture, 'classifier'))
        sendReply(`Note saved: ${result.text}`);
} else if (result.triage_action === 'promote') {
    if (shouldSendSignalReply(posture, 'classifier'))
        sendReply(`Promoted to doc: ${result.text}`);
} else if (result.triage_action === 'skip') {
    // intentionally silent
} else {
    if (shouldSendSignalReply(posture, 'fallback'))
        sendReply(`✓ #${result.id}`);
}
```

**Breaking**: No. Adds `notificationPosture?: NotificationPosture` to `PostMessageOptions`.

---

### F003: Ping on failed capture post

**Current**: Capture-post HTTP errors only log to console.

**Proposed**: After logging, send a posture-gated `failure` reply so the operator knows on their
phone that the message was not saved.

```typescript
// in handleMessage, in the .catch of post promise
console.error('[signal-relay] failed to post message:', err.message);
if (shouldSendSignalReply(signalNotificationPosture(), 'failure'))
    sendReply(`⚠️ Capture failed: ${err.message.slice(0, 120)}`);
```

The `⚠️` prefix is a deliberate visual difference from the normal `✓` / "Task queued" replies, so
the operator recognizes it as an error in Signal's notification preview.

**Breaking**: No. Previously silent; now sends in standard/active.

---

### F004: Ping on degraded capture (attachment upload failure)

**Current**: Attachment upload errors only log to console.

**Proposed**: After logging, send a posture-gated `failure` reply to notify the operator that the
capture was saved but the attachment was lost.

```typescript
// in handleMessage, in the attachment upload .catch
console.error(`[signal-relay] failed to store attachment ${att.id}:`, err.message);
if (shouldSendSignalReply(signalNotificationPosture(), 'failure'))
    sendReply(`⚠️ Attachment save failed (capture #${result.id}): ${err.message.slice(0, 80)}`);
```

**Breaking**: No. Previously silent; now sends in standard/active.

---

### F005: No ping for resurfacing (by design)

Resurfacing (`resurface.ts` / `cluster.ts`) is a background curation pass that adds rows to the
`surfaced` table for the surface UI to display. It is not user-triggered, not actionable from
Signal, and would generate unsolicited ambient pings. No Signal integration is added.

This is an explicit non-change, documented here so future contributors understand the decision.

---

## Testing Strategy

All new behavior is covered in `spine/src/signal-relay.test.ts`.

### New tests required

**`signalNotificationPosture`**
- Returns `standard` when env var is unset or invalid
- Returns each valid value when set

**`shouldSendSignalReply`**
- quiet × {failure, classifier, fallback} → false
- standard × failure → true
- standard × classifier → true
- standard × fallback → false
- active × {failure, classifier, fallback} → true

**`postCapture` posture gating**
- `triage_action: 'task'` in standard → sends "Task queued: ..."
- `triage_action: 'task'` in quiet → no reply sent
- `triage_action: 'promote'` in standard → sends "Promoted to doc: ..."
- `triage_action: null` (fallback) in active → sends "✓ #id"
- `triage_action: null` (fallback) in standard → no reply sent

**Failure pings**
- postCapture HTTP error in standard → `sendReply` called with "⚠️ Capture failed:..."
- postCapture HTTP error in quiet → `sendReply` not called

Note: attachment failure ping tests are integration-level (handleMessage) because the
`postAttachment` call is fire-and-forget inside `handleMessage`; they may be verified via
the relay test harness or manual review.

---

## Rollout

No phased rollout needed. The env var controls behavior; operators can set
`SIGNAL_NOTIFICATION_POSTURE=active` to restore previous behavior during evaluation.

**Rollback**: Set `SIGNAL_NOTIFICATION_POSTURE=active` to re-enable all prior reply behavior.

---

## Success Metrics

| Metric | Target |
|--------|--------|
| All existing relay tests pass | 100% |
| New posture unit tests pass | 100% |
| No changes to any non-relay file | Confirmed |
