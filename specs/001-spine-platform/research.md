# Research: Spine Platform

## Decision: Keep The Existing Spine Stack

Use the existing TypeScript/Bun/Elysia spine runtime, `bun:sqlite`, and current static-serving plugin.

**Rationale**: The constitution explicitly approves this stack, the current code already uses it, and the feature is platform hardening rather than a rewrite.

**Alternatives considered**: Adding a health-check library or process manager integration was rejected because it adds dependency surface without solving a current gap.

## Decision: Separate Liveness From Core Readiness

Keep `/ping` as an unauthenticated liveness endpoint and use authenticated `/api/status` for core-platform readiness.

**Rationale**: `/ping` is useful for local process checks without exposing private state. `/api/status` can safely include readiness details because it is already behind the Authentik guard.

**Alternatives considered**: Making `/ping` report detailed readiness was rejected because it would expose operational details publicly. Creating a new route group was rejected because the existing status route is sufficient.

## Decision: Core Ready Means Config, Storage, Auth Boundary, And Static Assets

Report ready only when configuration is valid, the database is initialized/upgraded, protected access can be enforced, and configured static assets are available.

**Rationale**: This matches the clarification answer and gives operators confidence that the platform foundation is usable without checking feature-specific domains.

**Alternatives considered**: Process-only readiness was too weak. Requiring all feature routes and downstream capabilities was too broad for this foundation feature.

## Decision: Prefer Direct Startup State Over Persisted Readiness State

Compute readiness from startup inputs and current process state rather than adding a new readiness table.

**Rationale**: Readiness is process-local operational state, not user data. Persisting it would add migration work without clear value.

**Alternatives considered**: Adding a `platform_status` table was rejected as unnecessary persisted state.

## Decision: Preserve Existing Auth Model

Retain Authentik header auth for non-agent routes and bearer-token auth for `/api/agent/*`.

**Rationale**: The constitution mandates this model. The platform feature should clarify and verify it, not introduce a new model.

**Alternatives considered**: Session cookies or direct login routes were rejected as out of scope and contrary to the Caddy/Authenik boundary.

## Decision: No New Accessibility Evidence Unless UI Is Added

Plan clear plain-text operator messages and JSON fields, but do not add `docs/accessibility/` artifacts unless implementation introduces a user-facing UI workflow.

**Rationale**: The feature affects server/platform surfaces, not a browser workflow. Status text can still follow accessible plain-language principles.

**Alternatives considered**: Creating accessibility evidence preemptively was rejected as process noise for a non-UI feature.
