# Data Model: Spine Platform

## Platform Configuration

Represents operator-controlled settings used at startup and request handling.

Fields:
- `database_path`: Local SQLite path selected from environment, config file, or default.
- `agent_token_present`: Whether the bearer-token boundary can be enforced for agent routes.
- `allow_http`: Development-only switch that permits non-HTTPS requests.
- `dev_user_present`: Development-only switch that bypasses Authentik header auth.
- `surface_build_path`: Optional static asset path configured for serving the browser surface.
- `host`: Bind host for the spine listener.

Validation rules:
- Production-safe access requires `allow_http` to be false and no `dev_user` bypass.
- Missing agent token means agent routes must reject all requests.
- Missing configured static assets make core readiness unhealthy when a static path is configured.

## Platform Storage State

Represents the local database readiness required by the foundation.

Fields:
- `database_open`: SQLite database handle was created successfully.
- `migrations_applied`: Number and names of applied migration files.
- `schema_migrations_present`: Whether migration tracking exists.
- `foreign_keys_enabled`: Whether SQLite foreign-key enforcement is active.
- `journal_mode`: SQLite journal mode after initialization.

Validation rules:
- Storage is ready only after migration tracking exists and all discovered migrations have been applied.
- Migration application remains forward-only and idempotent.
- QMD vector store is excluded from manual readiness migration state.

## Access Boundary

Represents request-level enforcement for private platform capabilities.

Fields:
- `browser_auth_model`: Authentik-forwarded username header for non-agent protected routes.
- `agent_auth_model`: Bearer token for `/api/agent/*` routes.
- `https_required`: Whether non-HTTPS forwarded requests are rejected.

Validation rules:
- Protected non-agent routes reject missing Authentik identity unless development bypass is explicitly set.
- Agent routes reject missing, malformed, or mismatched bearer tokens.
- Both protected paths reject non-HTTPS forwarded requests unless HTTP is explicitly allowed for development.

## Platform Status

Authenticated operator-facing readiness summary.

Fields:
- `ready`: Boolean indicating core-platform readiness.
- `state`: One of `ready`, `starting`, or `unhealthy`.
- `checks`: Named readiness checks for configuration, storage, access boundary, and static assets.
- `agents`: Existing agent status summaries.
- `active_agent_count`: Existing count of recently reporting agents.

State transitions:
- `starting` while the service is initialized enough to answer but required checks are not complete.
- `ready` when all core readiness checks pass.
- `unhealthy` when any required core readiness check fails after startup.
