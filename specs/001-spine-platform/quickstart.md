# Quickstart: Spine Platform

## Prerequisites

- Bun dependencies installed in `spine/`.
- For local development, use `ALLOW_HTTP=true DEV_USER=dev`.
- For production-style checks, send `x-forwarded-proto: https` and `x-authentik-username` headers through the reverse proxy path.

## Run Locally

```bash
just spine
```

Expected outcome:
- Spine listens on localhost.
- Database migrations are applied once and skipped on restart.
- `/ping` responds with `{ "ok": true }`.

## Check Core Readiness

```bash
curl -H 'x-forwarded-proto: https' -H 'x-authentik-username: dev' http://127.0.0.1:3000/api/status
```

Expected outcome:
- Response includes `ready`, `state`, `checks`, `agents`, and `active_agent_count`.
- `ready: true` means configuration is valid, storage is initialized/upgraded, protected access can be enforced, and configured static assets are available.

## Verify Fail-Closed Access

```bash
curl -i http://127.0.0.1:3000/api/status
```

Expected outcome without development bypass or forwarded HTTPS/auth headers:
- Request is rejected rather than returning private status details.

## Run Tests

```bash
cd spine && bun test
```

Targeted tests for this feature should cover:
- Database migration idempotency.
- Auth guard failure and success paths.
- Status readiness response shape.
- Missing static asset and missing token readiness messages.
