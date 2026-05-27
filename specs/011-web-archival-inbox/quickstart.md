# Quickstart: Web Archival And Inbox Evolution

## Prerequisites

- `LATTICE_AGENT_TOKEN` configured for spine agent routes.
- Local `monolith` binary installed on the spine host and available to the spine process path.
- Stock SingleFile browser extension configured to POST saved pages to `/api/agent/archive-page` with the bearer token.
- Surface dev proxy or production Caddy/Authentik path available for browser review.

## Local Development

1. Start spine with local auth/dev settings:

   ```bash
   cd spine
   ALLOW_HTTP=true DEV_USER=dev LATTICE_AGENT_TOKEN=dev-token bun run dev
   ```

2. Start surface:

   ```bash
   cd surface
   bun run dev
   ```

3. Submit a URL-only archive request:

   ```bash
   curl -X POST http://127.0.0.1:3000/api/agent/archive-url \
     -H 'Authorization: Bearer dev-token' \
     -H 'Content-Type: application/json' \
     -H 'X-Forwarded-Proto: https' \
     -d '{"url":"https://example.com","source":"scripted","why_saved":"quick archive smoke test"}'
   ```

4. Open Surface and verify the archive appears either as recently captured or as a recapture item depending on technical quality.

5. Submit a rendered HTML archive using SingleFile or a multipart smoke request:

   ```bash
   curl -X POST http://127.0.0.1:3000/api/agent/archive-page \
     -H 'Authorization: Bearer dev-token' \
     -H 'X-Forwarded-Proto: https' \
     -F 'url=https://example.com' \
     -F 'title=Example Domain' \
     -F 'source=browser-ext' \
     -F 'file=@/tmp/example.html;type=text/html'
   ```

6. Search for text from the archived page and confirm only good, non-superseded archive results appear by default.

## Validation Commands

Run from the repository root where feasible:

```bash
just check
just lint
just test
```

Targeted commands during development:

```bash
cd spine && bun test
cd spine && bun run lint
cd surface && bun run check
cd surface && bun run test:unit
cd surface && bun run test:e2e
```

## Manual Acceptance Checks

- Save a URL from a URL-only client and confirm an archive row, local HTML artifact, extracted text, and inbox/review state are created.
- Save a browser-rendered page through SingleFile and confirm it is quality `good`.
- Force a degraded URL-only result and confirm it appears as a recapture inbox item and triggers a Standard-posture attention message.
- Recapture the degraded URL with SingleFile and confirm the old archive is superseded and hidden from default search.
- Confirm a recently captured good archive appears for optional review, sends no Standard-posture Signal message, and auto-promotes after the settling period.
- Verify Quiet, Standard, and Active postures produce different attention behavior.
- Verify keyboard shortcuts for Re-capture, Delete, Keep, Archive, and Skip work in the inbox and do not fire from text fields.
- Confirm no inbox copy uses overdue, streak, or debt language.
