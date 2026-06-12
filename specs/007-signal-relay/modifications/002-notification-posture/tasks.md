# Tasks: Signal Relay - Notification Posture (002)

**Status**: Active
**Created**: 2026-06-11
**Spec**: `modification-spec.md`

---

## T001 - Add posture helpers to `signal-relay.ts`

**File**: `spine/src/signal-relay.ts`
**What**: Import `NotificationPosture` from `./archiveEvents`. Export `SignalReplyEvent`,
`signalNotificationPosture()`, and `shouldSendSignalReply()` as specified in F001.
Add `notificationPosture?: NotificationPosture` to `PostMessageOptions`.

**Done when**: New exports compile, existing tests still pass.

---

## T002 - Gate `postCapture` replies; add `promote` case

**File**: `spine/src/signal-relay.ts`
**What**: Replace unconditional `sendReply` calls in `postCapture` with posture-gated calls
per F002. Add the missing `promote` branch (`sendReply('Promoted to doc: ...')`).
Read posture via `options.notificationPosture ?? signalNotificationPosture()`.

**Done when**: task/keep/promote reply in standard, fallback reply only in active, quiet
suppresses all; verified by tests in T005.

---

## T003 - Failure ping on capture-post error

**File**: `spine/src/signal-relay.ts`
**What**: In `handleMessage`, inside the `.catch` for the `post` promise, add a
posture-gated `sendReply("⚠️ Capture failed: ...")` per F003.

**Done when**: Error path sends reply in standard/active and is silent in quiet; verified
by tests in T005.

---

## T004 - Degraded ping on attachment upload error

**File**: `spine/src/signal-relay.ts`
**What**: In `handleMessage`, inside the per-attachment `.catch`, add a posture-gated
`sendReply("⚠️ Attachment save failed ...")` per F004.

**Done when**: Attachment error path sends reply in standard/active and is silent in quiet.
Manual or integration-level verification; add a code comment pointing to the spec section.

---

## T005 - Tests

**File**: `spine/src/signal-relay.test.ts`
**What**: Add unit tests covering:
- `signalNotificationPosture`: unset/invalid → standard; valid values round-trip
- `shouldSendSignalReply`: full posture × event matrix (9 cases)
- `postCapture` posture gating: task in standard (reply), task in quiet (no reply),
  promote in standard (reply), fallback in active (reply), fallback in standard (no reply)
- `postCapture` failure ping: HTTP error in standard (reply), HTTP error in quiet (no reply)

Run `bun test spine/src/signal-relay.test.ts` to verify.

---

## T006 - Document `SIGNAL_NOTIFICATION_POSTURE` in spine CLAUDE.md

**File**: `spine/CLAUDE.md`
**What**: Add `SIGNAL_NOTIFICATION_POSTURE` row to the environment variables table,
alongside the existing `ARCHIVE_NOTIFICATION_POSTURE` row.

**Done when**: The table includes the new var with default and notes.

---

## Completion Criteria

- [ ] T001: posture helpers compile, tests pass
- [ ] T002: postCapture reply logic gated + promote case added
- [ ] T003: failure ping wired up
- [ ] T004: degraded ping wired up
- [ ] T005: all new unit tests green
- [ ] T006: env var documented
- [ ] `bun test` passes with no regressions
