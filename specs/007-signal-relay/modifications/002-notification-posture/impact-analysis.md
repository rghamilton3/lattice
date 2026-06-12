# Impact Analysis: Signal Relay - Notification Posture

**Feature**: Signal Relay (007)
**Modification**: 002-notification-posture
**Analysis Date**: 2026-06-11

---

## Proposed Changes

Gate Signal relay text replies (`sendReply`) behind a `SIGNAL_NOTIFICATION_POSTURE` toggle
(quiet / standard / active, default standard). Add pings for failure and degraded-extraction
cases that are currently silent. Add a `promote` reply case that is currently missing. Never
ping for resurfacing (by design). No new build, no schema changes.

**Change categories**:
- Behavior: reply suppression by posture, new failure pings, new promote reply
- Config: one new env var (`SIGNAL_NOTIFICATION_POSTURE`)
- No data model changes
- No API/contract changes
- No UI changes

---

## Affected Components

### Direct
| Component | Type | Impact | Notes |
|-----------|------|--------|-------|
| `spine/src/signal-relay.ts` | Relay process | High | All logic changes land here |
| `spine/src/signal-relay.test.ts` | Tests | Medium | New posture test cases |

### Indirect (read-only dependency)
| Component | Type | Impact | Notes |
|-----------|------|--------|-------|
| `spine/src/archiveEvents.ts` | Library | Low | Imports `NotificationPosture` type only |

No other files are affected. The resurfacing subsystem (`resurface.ts`, `cluster.ts`) is
intentionally excluded - no Signal integration is planned or added for it.

---

## Breaking Changes Assessment

**Breaking Changes Identified: No**

All changes are additive or behavioral adjustments with a safe default. The current
behavior (send all replies) maps to `active` posture. The default is `standard`, which
changes the fallback "✓ #id" reply (currently always sent) to be suppressed unless
posture is `active`. This is intentional and desirable - the fallback reply is noise.

The only observable difference from existing deployments is that unclassified captures
no longer reply with "✓ #id" unless `SIGNAL_NOTIFICATION_POSTURE=active` is set. This
is low-risk because the fallback reply has no semantic value beyond confirming receipt,
and ✅ reactions already provide that confirmation visually.

---

## Backward Compatibility Strategy

No compatibility layer needed. The new env var defaults to `standard`, which is the
intended production baseline. Existing deployments with no env var set will silently
adopt `standard` posture.

---

## Risk Assessment

**Risk Level: Low**

| Risk | Likelihood | Impact | Mitigation |
|------|------------|--------|------------|
| Failure ping floods in unstable env | Low | Medium | Ping only sends text reply; ✅ reaction is gated separately |
| Operators expect the old "✓ #id" reply | Low | Low | Set `SIGNAL_NOTIFICATION_POSTURE=active` to restore |
| `promote` reply reveals unexpected text truncation | Low | Low | Reuses existing `result.text` already logged |

**Overall Risk Score**: 2/10

---

## Testing Requirements

### Existing tests to verify still pass
- All existing `signal-relay.test.ts` cases - posture-neutral behavior should be unchanged

### New tests required
- `shouldSendSignalReply`: all combinations of posture × event
- `signalNotificationPosture`: env var parsing and default
- `postCapture` gated replies: task/keep/promote/fallback across postures
- `postCapture` failure ping: sent in standard/active, suppressed in quiet
- Attachment degraded ping: sent in standard/active, suppressed in quiet

---

## Recommendations

1. Keep reactions (👀/✅) ungated - they are unobtrusive emoji feedback, not text pings.
2. Keep the `/task` failure reply (`Could not fetch tasks...`) ungated - it is a response
   to an explicit user command, not an ambient notification.
3. Document `SIGNAL_NOTIFICATION_POSTURE` in `spine/CLAUDE.md` alongside `ARCHIVE_NOTIFICATION_POSTURE`.

**Proceed with Modification: Yes**
