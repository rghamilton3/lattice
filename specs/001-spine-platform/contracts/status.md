# Contract: Spine Platform Status

## GET /api/status

Authentication: Authentik-protected non-agent route.

Purpose: Let an authenticated operator inspect core platform readiness and existing agent reporting state.

### Successful Response

Status: `200 OK`

```json
{
  "ready": true,
  "state": "ready",
  "checks": {
    "configuration": {
      "ok": true,
      "message": "Configuration is valid"
    },
    "storage": {
      "ok": true,
      "message": "Storage is initialized",
      "applied_migrations": 9
    },
    "access_boundary": {
      "ok": true,
      "message": "Protected access can be enforced"
    },
    "static_assets": {
      "ok": true,
      "message": "Static assets are available"
    }
  },
  "agents": [
    {
      "machine_id": "host1",
      "state": "idle",
      "last_scan_at": "2026-01-01T00:00:00.000Z",
      "last_indexed": 10
    }
  ],
  "active_agent_count": 1
}
```

### Unhealthy Response

Status: `200 OK`

The route still returns `200` when the spine can answer the authenticated request. Readiness failures are represented in the body.

```json
{
  "ready": false,
  "state": "unhealthy",
  "checks": {
    "configuration": {
      "ok": false,
      "message": "Agent token is not configured; agent routes will reject requests"
    },
    "storage": {
      "ok": true,
      "message": "Storage is initialized",
      "applied_migrations": 9
    },
    "access_boundary": {
      "ok": true,
      "message": "Protected access can be enforced"
    },
    "static_assets": {
      "ok": false,
      "message": "Configured static asset path is unavailable"
    }
  },
  "agents": [],
  "active_agent_count": 0
}
```

### Unauthorized Or Unsafe Requests

- Missing Authentik identity on non-development requests: `401 Unauthorized`.
- Non-HTTPS forwarded request when HTTP is not explicitly allowed: `400 HTTPS required`.
