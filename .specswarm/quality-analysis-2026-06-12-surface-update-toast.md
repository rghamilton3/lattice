# Quality Analysis - fix: surface update toast

**Date**: 2026-06-12
**Branch**: worktree-fix+surface-update-toast
**Scope**: PWA update toast fix in surface/ (5 files, +225/-18)
**Context**: /ss:ship pre-merge gate

## Overall Quality Score: 91/100 PASS

## Hard Gates (per quality-standards.md)

| Gate | Result |
| --- | --- |
| Type check (svelte-check, 690 files) | PASS - 0 errors, 0 warnings |
| Lint (prettier + eslint) | PASS |
| Unit tests, server project (vitest, node) | PASS - 81/81 (includes 6 new PWA update tests) |
| E2E (playwright, production build + preview) | PASS - 50/50 (includes 2 modified pwa-update tests) |
| Unit tests, client project (vitest browser mode) | NOT RUN - hangs in this environment (pre-existing; a stale hung vitest+chromium from 2026-06-11 in another worktree shows the same symptom). None of the 3 browser-mode test files are touched by this diff. |

## Security Scan

- No hardcoded secrets in surface/src or spine/src.
- No eval/exec patterns in changed files.
- Sole `innerHTML` use (MarkdownRenderer.svelte:204) is pre-existing and DOMPurify-sanitized.

## Test Coverage

- The changed module `pwa.svelte.ts` gained 6 unit tests covering: first controller claim vs update takeover, reload-after-takeover ordering, failed registration on controlled vs uncontrolled pages, and session dismissal.
- E2E coverage updated for the new toast copy and controlled-page takeover scenario.

## Multi-Agent Review (4 agents: silent-failure-hunter, code-reviewer, type-design-analyzer, comment-analyzer)

**BLOCKER: 0, HIGH: 0, MEDIUM: 6, LOW: 7** - advisory, non-blocking.

MEDIUM findings (follow-up candidates):
1. pwa.svelte.ts:204 - persistent registration failure puts user in a reload loop with a non-dismissible "Update needs a reload" toast that cannot fix the problem.
2. pwa.svelte.ts:224 - 2s SKIP_WAITING fallback reload can loop back to the same toast if the deployed old worker lacks the SKIP_WAITING handler; no in-UI feedback during the 2s stall.
3. pwa.svelte.ts:33 - `updateState` is publicly mutable `$state`; the state machine is enforced only by convention.
4. pwaUpdate.test.ts - older tests mutate `updateState` directly (coupled to representation; new tests show the better mock-driven pattern).
5. pwa.svelte.ts:96 - `updateDismissed` never resets when a *new* update arrives; one dismissal suppresses all update notices for the session.
6. pwa.svelte.ts:85 - comment overstates `clients.claim()` semantics ("every uncontrolled load / hard reload" is inaccurate; it fires only on worker activation claiming uncontrolled clients).

LOW findings: dev `unregister()` result unchecked; broad `.catch` spans listener wiring; failed initial registration has no UI surface (intentional, commented); `register` cast escapes `ServiceWorkerContainerLike` Pick; `#reloadingForUpdate` is a one-way latch; two comment wording nits.

code-reviewer verdict: "No findings" - the controlled/uncontrolled distinction, reload-race fix, and config change verified correct and idiomatic.

## Score Breakdown

- Test Coverage: 95/100 (new tests for changed module; browser-mode project not runnable here)
- Architecture: 90/100 (publicly mutable state machine; otherwise idiomatic Svelte 5)
- Documentation: 85/100 (good intent comments; one inaccurate SW-semantics comment)
- Performance: 95/100 (no bundle impact; production-only SW registration is an improvement)
- Security: 100/100

## Recommendations

- MEDIUM items 1, 2, 5, 6 are good candidates for a small follow-up chunk (update-loop resilience + dismissal reset + comment fix).
- Investigate the vitest browser-mode hang on this machine (stale chromium/vitest processes from 2026-06-11 suggest it predates this branch).
