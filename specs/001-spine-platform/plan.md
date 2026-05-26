# Implementation Plan: Spine Platform

**Branch**: `001-spine-platform` | **Date**: 2026-05-25 | **Spec**: [spec.md](./spec.md)

**Input**: Feature specification from `/specs/001-spine-platform/spec.md`

## Summary

Strengthen the Lattice spine foundation so a self-hosting operator can start the service, trust that storage and access boundaries are initialized safely, serve configured static assets, and inspect core platform readiness. The implementation keeps the existing spine architecture and adds minimal platform-readiness plumbing around configuration validation, status reporting, and tests.

## Technical Context

**Language/Version**: TypeScript on Bun 1.x for spine runtime

**Primary Dependencies**: Existing Elysia server, `@elysiajs/static`, `bun:sqlite`, `smol-toml`; no new runtime dependencies planned

**Storage**: SQLite via `bun:sqlite`; numbered forward-only SQL migrations in `spine/migrations/`; QMD vector store remains managed by `@tobilu/qmd` and is not hand-migrated

**Testing**: `bun test` in `spine/`; targeted route/unit tests for status, guards, config, and database initialization

**Target Platform**: Self-hosted Linux/VPS or local development host, with production traffic expected through Caddy + Authentik and spine bound to localhost

**Project Type**: Web service foundation inside the existing monorepo (`spine/` only for source changes)

**Performance Goals**: Clean startup reaches core-platform ready status in under 2 minutes; status response remains lightweight enough for operator checks under 10 seconds

**Constraints**: Fail closed for protected access; no mandatory external services; no ORM; additive migrations only; no cross-component imports; no new user-facing UI workflow

**Scale/Scope**: Single-user/self-hosted personal knowledge server; foundation work limited to startup/config/storage/auth/static/status/deployment helpers


## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

Answer each question. Any "Yes" requires a Complexity Tracking entry with justification
before implementation may proceed.

| Principle | Gate Question | Pass / Violation |
|-----------|--------------|-----------------|
| I. Self-Hosting First | Does this feature add a mandatory external service (cloud DB, hosted API, SaaS auth)? | Pass - no external service added |
| II. Component Boundaries | Does this feature introduce cross-component coupling beyond REST API contracts? | Pass - spine-only implementation; static serving remains existing boundary |
| III. Local-First Data | Does this feature store user data outside user-controlled SQLite/local files? | Pass - storage remains local SQLite/files |
| IV. Security by Design | Does this feature add a new route group without a declared auth model? | Pass - no new route group; `/api/status` remains Authentik-protected |
| V. Simplicity over Abstraction | Does this feature introduce an abstraction with fewer than 3 concrete callsites? | Pass - plan favors direct readiness helpers only where needed |
| V. Simplicity over Abstraction | Does this feature introduce an ORM, feature flag, or backwards-compat shim without a shipped external dependency or persisted-data migration requiring it? | Pass - none planned |
| Tech Stack | Does this feature add a runtime dependency outside the approved technology stack? | Pass - no new runtime dependencies planned |

## Project Structure

### Documentation (this feature)

```text
specs/001-spine-platform/
├── plan.md
├── research.md
├── data-model.md
├── quickstart.md
├── contracts/
│   └── status.md
└── tasks.md
```

### Source Code (repository root)

```text
spine/
├── src/
│   ├── app.ts
│   ├── config.ts
│   ├── db.ts
│   ├── guards.ts
│   ├── index.ts
│   └── routes/
│       └── status.ts
├── migrations/
├── tests/
│   ├── routes/
│   │   ├── guards.test.ts
│   │   ├── ping.test.ts
│   │   └── status.test.ts
│   └── unit/
│       ├── config.test.ts
│       └── db.test.ts
├── Dockerfile
└── docker-compose.yml

Justfile
```

**Structure Decision**: Keep implementation in the existing `spine/` component. Surface, agent, capture, search, documents, attachments, tasks, and relay behavior stay out of scope except where their existing routes are hosted or protected by the spine foundation.

## Phase 0: Research

Research output is captured in [research.md](./research.md). Decisions: reuse existing spine stack, keep `/ping` as liveness, make `/api/status` report authenticated core platform readiness, validate readiness from known startup inputs, and avoid new dependencies or migrations unless implementation reveals a concrete persisted field need.

## Phase 1: Design And Contracts

Design output is captured in [data-model.md](./data-model.md), [contracts/status.md](./contracts/status.md), and [quickstart.md](./quickstart.md).

## A11Y Governance

No new interactive browser UI is planned. User-facing changes are limited to JSON status fields and operator-facing startup/status messages. Apply clear language to status and startup errors, avoid color-only terminal distinctions, and verify changed terminal output remains readable in plain text. Bilingual delivery is explicitly out of scope for this feature because no multilingual content requirement exists. `docs/accessibility/` evidence is not required unless implementation adds a new UI workflow.

## Post-Design Constitution Check

| Principle | Gate Question | Pass / Violation |
|-----------|--------------|-----------------|
| I. Self-Hosting First | Does this feature add a mandatory external service (cloud DB, hosted API, SaaS auth)? | Pass |
| II. Component Boundaries | Does this feature introduce cross-component coupling beyond REST API contracts? | Pass |
| III. Local-First Data | Does this feature store user data outside user-controlled SQLite/local files? | Pass |
| IV. Security by Design | Does this feature add a new route group without a declared auth model? | Pass |
| V. Simplicity over Abstraction | Does this feature introduce an abstraction with fewer than 3 concrete callsites? | Pass |
| V. Simplicity over Abstraction | Does this feature introduce an ORM, feature flag, or backwards-compat shim without a shipped external dependency or persisted-data migration requiring it? | Pass |
| Tech Stack | Does this feature add a runtime dependency outside the approved technology stack? | Pass |

## Complexity Tracking

No constitution violations.
