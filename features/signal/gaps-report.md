> BACKFILLED ARTIFACT
> Reverse-engineered from `spine/src/signal/` and `spine/src/signal-relay.ts` on 2026-05-23.

# Gaps Report: signal

## 1. Summary Verdict

**Medium gap**

Unit tests exist for `parseSignalMessage()` (the pure parsing core) but `signal-relay.ts` itself
has no automated tests. Error handling is present but unstructured. No tracking plan or monitoring
setup.

## 2. Missing Artifacts

| Artifact | Status |
|----------|--------|
| `research/` - competitor / UX / metrics research | Missing |
| ADRs in `plan.md` | Missing - socket state machine design rationale not documented |
| Integration tests for `signal-relay.ts` (TCP mock + spine mock) | Missing |
| Tracking plan entries (capture delivery rate, reaction latency) | Missing |
| Feature flag registry entries | Missing |
| Release-readiness checklist (monitoring dashboard, alerts on relay crash) | Missing |
| Retry queue for failed spine POSTs | Missing (observed gap, not just docs) |
| Structured logging (tracing / pino) | Missing — `console.error` only |

## 3. Inferred vs Observed

| Claim | Source | Confidence |
|-------|--------|------------|
| Note-to-Self is the primary use case | `wrong-destination` skip logic + `SIGNAL_PHONE === selfNumber` filter | HIGH |
| 👀 = relay received, ✅ = spine persisted | Comment in signal-relay.ts | HIGH |
| Exponential backoff prevents connection storm | `backoff` variable + state machine comments | HIGH |
| Attachments from SIGNAL_ATTACHMENTS_DIR are uploaded | upload block in relay | HIGH |
| Single-user, single-phone design | Only one `SIGNAL_PHONE_NUMBER` env var | HIGH |
| Message loss acceptable if spine is down | No retry queue observed | MEDIUM |
| voice note placeholder is final UX | `placeholderText()` function | MEDIUM — may be temporary |
| RPC port 7583 is the signal-cli default | Hardcoded default in env fallback | MEDIUM |

## 4. Recommended Next Actions

1. **Add integration tests** for `signal-relay.ts`: mock a TCP JSON-RPC stream + mock spine
   endpoint; verify reaction sequencing and attachment upload.

2. **Add structured logging** — replace `console.error/warn` with `tracing` or `pino` so relay
   failures are observable without tailing stdout.

3. **Define a retry policy** for failed spine POSTs — at minimum log the dropped message ID so
   a user can see what was lost.

4. **Run tracking plan** to decide which metrics to emit.

5. **Run release-readiness** to set up a crash alert on the relay process.
