# Quickstart: Tracking Phase 0

## Prerequisites

- Run spine in development with agent token, dev auth, and HTTP allowed as appropriate for local testing.
- Apply migrations by starting spine normally; `010_tracks.sql` should be applied on startup.
- Keep existing non-tracking capture flows available for regression checks.

## Local API Smoke Test

1. Start spine:

```bash
ALLOW_HTTP=true DEV_USER=dev LATTICE_AGENT_TOKEN=dev-token bun run --cwd spine dev
```

2. Create a normal track:

```bash
curl -sS -X POST http://localhost:3000/api/agent/track \
  -H 'authorization: Bearer dev-token' \
  -H 'content-type: application/json' \
  -d '{"text":"drill is on the garage top shelf, blue case","captured_at":"2026-05-26T14:30:12Z","source":"manual-smoke","displaced":false}'
```

3. Create a checkout/displaced track:

```bash
curl -sS -X POST http://localhost:3000/api/agent/track \
  -H 'authorization: Bearer dev-token' \
  -H 'content-type: application/json' \
  -d '{"text":"drill working on the deck","captured_at":"2026-05-26T14:31:12Z","source":"manual-smoke","displaced":true}'
```

4. Search for the track through browser-auth route:

```bash
curl -sS 'http://localhost:3000/api/tracks/search?q=drill' \
  -H 'x-forwarded-proto: https' \
  -H 'x-authentik-username: dev'
```

5. Mark a result opened:

```bash
curl -sS -X POST http://localhost:3000/api/tracks/queries/1/open \
  -H 'x-forwarded-proto: https' \
  -H 'x-authentik-username: dev' \
  -H 'content-type: application/json' \
  -d '{"track_id":1}'
```

## Validation Checklist

- Normal and checkout records insert through `/api/agent/track`.
- Blank text is rejected with no record created.
- Missing/invalid bearer token cannot write a track.
- Search requires browser/AuthentiK-style auth and returns text, time, source, displaced state, and ID.
- Newest useful matching records are easiest to identify while older records remain visible.
- Opening a result updates the query row.
- `/api/agent/capture` and existing Signal `/capture` behavior still work.

## Device/Channel Smoke Tests

### HA Voice

- Configure one Atom Echo in the Printing Room.
- Test `track drill is on the top shelf`.
- Test `check out drill working on the deck`.
- Confirm both records are searchable within 5 seconds and show `source: ha-voice:printing-room` with correct displaced state.

### Tasker Phone Voice

- Test `OK Google, run track in Tasker with drill is on the top shelf`.
- Test `OK Google, run checkout in Tasker with drill working on the deck`.
- Confirm both records are searchable within 10 seconds and show `source: tasker-voice`.
- Confirm TV/other assistant devices do not intercept the accepted flow.

### Signal

- Send `/track test from signal`.
- Send `/checkout test displacement from signal`.
- Confirm both records are searchable and show `source: signal-text` with correct displaced state.
- If testing photo support, send a photo with `/track caption text` and confirm the caption is searchable and a photo reference is preserved.

## Accessibility And Language Checks

- If no persistent Surface UI changed, record accessibility evidence as N/A in the implementation notes.
- If Surface search/open-result UI changed, verify keyboard reachability, focus visibility, labels, readable empty/error states, and non-color-only displaced state.
- Bilingual delivery is N/A for Phase 0 unless translation resources are introduced separately.
