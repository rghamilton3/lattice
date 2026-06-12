# Quality Analysis Report - Feature 020: Signal Voice Capture Pipeline

**Generated**: 2026-06-11
**Branch**: 020-signal-voice-capture
**Scope**: Merge diff vs parent (spine extraction/transcription core, routes, relay retry,
new asr-shim component, surface transcription UI, specs/020)

---

## Overall Quality Score: 92/100

```
===============================================
Quality Analysis Report - Feature 020
===============================================

Overall Quality Score: 92/100 PASS (gate: 80)

Breakdown:
- Test Coverage:   95/100
- Architecture:    95/100
- Documentation:   90/100
- Performance:     90/100
- Security:        95/100

Issues Found:
- Critical:  0
- High:      0
- Medium:    2
- Low:       3

Total Issues: 5
```

---

## 1. Test Results (gates)

- **spine (Bun)**: `bun test` - 542 pass, 0 fail (34 new tests in this diff:
  transcribe client 7, transcription events 5, voice pipeline integration 16,
  SSE bridge 1, relay retry 5)
- **spine types**: `tsc --noEmit` - clean
- **spine lint**: `oxlint src/` - clean; prettier clean
- **asr-shim (Python)**: `uv run pytest` - 11 pass (conversion 5, API contract 6);
  additionally smoke-verified against a real ffmpeg-generated Opus file
- **surface**: `svelte-check` - 692 files, 0 errors, 0 warnings; prettier + eslint
  clean; new `attachments.test.ts` - 4 pass
- **surface browser-mode vitest**: not runnable in this headless environment
  (needs Playwright display); pre-existing limitation, not a regression

## 2. Requirement coverage (spec traceability)

Every requirement group has at least one verifying test or explicit code path:

| Group | Verified by |
|-------|-------------|
| SR-4 caption + audio | voice-transcription test "caption text untouched" |
| SR-5 relay retry | 5 fetchWithSpineRetry/postAttachment tests |
| IN-3/IN-4 async enqueue | upload route test + healthy-path lifecycle test |
| TX-3 sweep (pending/processing/transient) | crash-recovery + re-sweep tests |
| TX-5/TX-6 transient vs terminal | failure-class tests, terminal-not-resweep test |
| TX-7/RH-4 confirmed protection | "never overwritten by re-runs" test (asserts zero ASR calls) |
| RH-1/RH-2 indexed transcript | attachment-index markdown assertion |
| AS-1/2/5/6, AC-2/3/4 | shim pytest contract suite + startup ffmpeg check |
| NT-1/2/3 | posture gating tests, SSE bridge test, Open/Skip toast (no X) |
| NT-4 retry surface | retry-extraction endpoint tests + inbox Retry action |
| NF-4 deletion | NF-4 cleanup test (file + index + description rows) |

## 3. Architecture (constitution check)

- **P1**: all spine/surface changes TypeScript; shim is a new Python component
  outside the TS trees (same standing as the Rust agent) - PASS
- **P2**: transcripts enter search only via writeAttachmentIndex/refreshIndex;
  no new structuredSearch call sites - PASS
- **P3**: no new listeners; spine makes outbound /v1 calls only - PASS
- **P4**: ingestion returns before transcription; no capture-time decisions - PASS
- **P5**: 49 new tests across three components - PASS
- **P6**: no em dashes in the diff (verified by grep) - PASS
- One shared extraction model retained (processing state added uniformly);
  no parallel status mechanism introduced.

## 4. Security

- No secrets in the diff (grep verified); bearer keys come from existing config.
- Shim binds via llama-swap-managed process; no new public surface.
- Signal upload path keeps existing path-traversal defenses; retry endpoint is
  Authentik-gated like its siblings.
- ffmpeg invoked with fixed argument vector on temp files (no shell
  interpolation of user input).

## 5. Issues

🟡 MEDIUM:
1. Surface browser-mode vitest suite cannot run headless here, so the new
   Svelte components (InboxAudioNotes, toast actions) are verified by
   type-check + lint + API-layer unit tests only. Mitigation: manual quickstart
   pass before /ss:ship; components reuse established patterns.
2. Relay spooling (SR-5) is bounded in-memory retry (3x, 5s/15s/45s), not a
   durable on-disk envelope spool. Documented in research.md D8; a spine outage
   longer than ~65s during a send can still drop the envelope (bytes remain in
   signal-cli's directory). Acceptable for single-host deploy; revisit if the
   spine moves off-host.

🟢 LOW:
3. Non-audio extraction failures write an unprefixed failure reason (neither
   transient: nor terminal:), preserving today's no-auto-retry behavior; the
   manual retry endpoint covers them. Could be classified later.
4. Working-doc audio attachments transcribe but emit no attention events
   (by design, inbox-oriented); not surfaced in working-doc UI yet.
5. NeMo numpy<2 pin (research D2) may complicate GPU-host install; pinned note
   in asr-shim README, verify at deploy time.

## 6. Recommendations

1. Before shipping: run the quickstart end-to-end on the GPU host (real NeMo,
   llama-swap entry) - the only leg not exercised by automated tests.
2. Consider promoting transient/terminal classification to non-audio extraction
   types in a follow-up (free now that the column exists).

**Estimated impact**: items 1-2 are environment/deploy verifications; no code
changes required to clear the 80-point gate.
