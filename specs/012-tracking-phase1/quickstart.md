# Quickstart: Tracking Phase 1

## Prerequisites

- Phase 0 tracking substrate is present and tests pass.
- Spine runs with agent token, dev auth, and HTTP allowed for local testing.
- Existing Phase 0 tracking paths can still create records through `/api/agent/track`.

## Local Full-Cycle Smoke Test

1. Start spine:

```bash
ALLOW_HTTP=true DEV_USER=dev LATTICE_AGENT_TOKEN=dev-token bun run --cwd spine dev
```

2. Create an older related track:

```bash
curl -sS -X POST http://localhost:3000/api/agent/track \
  -H 'authorization: Bearer dev-token' \
  -H 'content-type: application/json' \
  -d '{"text":"drill on the workbench","captured_at":"2026-05-20T14:30:12Z","source":"manual-smoke","displaced":false}'
```

3. Create the current track and observe duplicate hints if applicable:

```bash
curl -sS -X POST http://localhost:3000/api/agent/track \
  -H 'authorization: Bearer dev-token' \
  -H 'content-type: application/json' \
  -d '{"text":"drill is on the garage top shelf, blue case","captured_at":"2026-05-26T14:30:12Z","source":"manual-smoke","displaced":false}'
```

4. Search with ordinary wording:

```bash
curl -sS 'http://localhost:3000/api/tracks/search?q=where%20is%20the%20drill' \
  -H 'x-forwarded-proto: https' \
  -H 'x-authentik-username: dev'
```

5. Open the primary result:

```bash
curl -sS -X POST http://localhost:3000/api/tracks/queries/<query_id>/open \
  -H 'x-forwarded-proto: https' \
  -H 'x-authentik-username: dev' \
  -H 'content-type: application/json' \
  -d '{"track_id":<track_id>}'
```

6. After the eligibility threshold, list pending follow-ups:

```bash
curl -sS 'http://localhost:3000/api/tracks/followups' \
  -H 'x-forwarded-proto: https' \
  -H 'x-authentik-username: dev'
```

7. Close one follow-up as still accurate:

```bash
curl -sS -X POST http://localhost:3000/api/tracks/followups/<query_id>/still-accurate \
  -H 'x-forwarded-proto: https' \
  -H 'x-authentik-username: dev'
```

8. Repeat with another query and close it as moved:

```bash
curl -sS -X POST http://localhost:3000/api/tracks/followups/<query_id>/moved \
  -H 'x-forwarded-proto: https' \
  -H 'x-authentik-username: dev' \
  -H 'content-type: application/json' \
  -d '{"text":"drill is in the basement charging","captured_at":"2026-05-27T08:15:00Z","source":"manual-followup","displaced":false}'
```

9. Repeat with another query and close it as skipped:

```bash
curl -sS -X POST http://localhost:3000/api/tracks/followups/<query_id>/skip \
  -H 'x-forwarded-proto: https' \
  -H 'x-authentik-username: dev'
```

## Validation Checklist

- Track insert still accepts free-form text and does not require category, tag, zone, or item/location fields.
- New track responses include `possible_duplicates` when there is strong recent overlap and still save when hints are present.
- Search by ordinary wording returns a primary newest answer and distinguishable older history.
- Opening a result records `opened_track_id` for the query.
- Follow-ups appear only for opened results after the eligibility threshold.
- Follow-ups do not appear when a newer matching track exists after the opened query.
- Still-accurate closes the query without creating a new track.
- Moved creates a new append-only track with continuity to the opened track where supported.
- Skip closes the query without visible debt or repeat nagging.
- Expired follow-ups disappear and are recorded as expired.
- Existing `/api/agent/capture`, `/api/agent/track`, `/api/tracks/search`, and Signal `/capture` behavior remain intact.

## Accessibility And Language Checks

- If persistent Surface UI changed, update `docs/accessibility/tracking-phase1.md` with keyboard, focus, label, and non-color-only state evidence.
- If using CLI/curl or Signal flows, confirm output is readable plain text, action labels are explicit, and no state depends on color.
- Confirm follow-up copy avoids backlog, streak, overdue, debt, or nagging language.
- Bilingual delivery is N/A for Phase 1 unless translation resources are introduced separately.

## Done Evidence

- Record one full real-item cycle: track, query, open result, receive follow-up, answer follow-up.
- Record at least three real-item loop closures across the three outcomes where practical.
- Note any physical HA Voice, Tasker, or live Signal checks that cannot be run in the coding environment.
