<!--
SYNC IMPACT REPORT
==================
Version change: [TEMPLATE] -> 1.0.0 (initial constitution from template)
Modified principles: none (initial fill)
Added sections:
  - Core Principles (I-V)
  - Technology Stack
  - Development Workflow
  - Governance
Removed sections: none
Templates updated:
  - .specify/templates/plan-template.md  [Constitution Check gates]  ✅ updated
  - .specify/templates/spec-template.md                              ✅ no changes required
  - .specify/templates/tasks-template.md                             ✅ no changes required
Deferred TODOs: none
-->

# Lattice Constitution

## Core Principles

### I. Self-Hosting First

Lattice MUST be deployable on user-owned infrastructure with no mandatory external services.
Every feature decision MUST be evaluated against its self-hosting burden. Added infrastructure
dependencies require explicit justification. The deployment target is a single VPS running
Caddy + Authentik + spine (Docker). Designs that assume cloud-managed databases, object
storage, or hosted auth services MUST be rejected unless a self-hosted alternative is
documented alongside.

Rationale: Lattice is a personal knowledge management system. Privacy and control are
the core value proposition. Vendor lock-in directly undermines the product's purpose.

### II. Component Boundaries

The monorepo MUST maintain strict role separation:

- `spine/` owns all data persistence, REST API, and static file serving.
- `surface/` owns all browser UI; it communicates with spine via `/api/*` only.
- `agent/` owns local file watching and indexing; it communicates with spine via
  bearer-token-authenticated POST requests only.

Cross-component coupling beyond documented REST contracts is prohibited. Shared types
MUST be serialized across the wire; no direct in-process imports between components.
New inter-component communication channels require a documented API contract before
implementation.

Rationale: Component boundaries enable independent deployment and testing. They prevent
the monorepo from collapsing into a distributed monolith with hidden coupling.

### III. Local-First Data

User data MUST reside in user-controlled storage. The primary store is SQLite via
`bun:sqlite`. The vector store (`lattice.qmd.db`) is managed by `@tobilu/qmd` and
MUST NOT be hand-migrated. Migrations MUST be numbered SQL files in `spine/migrations/`,
applied in order on startup, and MUST be forward-only (no destructive rollbacks in
production). External cloud storage for core functionality is prohibited.

Rationale: Local-first storage guarantees user data does not leave user-controlled
infrastructure, aligns with the self-hosting principle, and eliminates network-failure
modes for primary operations.

### IV. Security by Design

All external traffic MUST flow through Caddy with Authentik forward auth. Spine MUST
bind to localhost only. The following rules are non-negotiable:

- `/api/agent/*` routes MUST authenticate via bearer token against `LATTICE_AGENT_TOKEN`.
- All other routes MUST authenticate via the `X-Authentik-Username` header injected by Caddy.
- Spine MUST fail closed on non-HTTPS requests (unless `ALLOW_HTTP=true` in dev).
- `DEV_USER` and `ALLOW_HTTP` MUST NOT be set in production configuration.
- New route groups MUST declare their auth model before implementation.

Rationale: A single-user personal system is a high-value target. Fail-closed defaults
and defense-in-depth prevent misconfiguration from silently exposing private data.

### V. Simplicity over Abstraction

Abstractions MUST be deferred until a pattern appears at 3 or more concrete callsites in
production code. Three similar lines are preferable to a premature helper. No ORM:
database access MUST use `bun:sqlite` directly with typed query results. Feature flags,
backwards-compatibility shims, and speculative generality are prohibited. YAGNI applies:
implement what is needed now, not what might be needed later.

Complexity violations (abstractions with fewer than 3 callsites, additional dependencies,
new infrastructure components) MUST be justified in the plan's Complexity Tracking table
before implementation begins.

Rationale: Lattice is maintained by a single developer. Premature abstractions increase
cognitive load and create surface area for bugs without delivering proportional value.

## Technology Stack

Additions to or removals from the approved technology stack require explicit justification
in the relevant feature plan.

| Layer | Approved Technology |
|-------|-------------------|
| Spine runtime | TypeScript / Bun / Elysia |
| Spine database | SQLite via `bun:sqlite`; vector store via `@tobilu/qmd` |
| Surface framework | SvelteKit (static adapter - no SSR) |
| Surface styling | Tailwind CSS v4 (Vite plugin) |
| Surface state | TanStack Query (server state), Svelte 5 runes (UI state) |
| Surface editor | CodeMirror 6 with Vim bindings |
| Agent runtime | Rust |
| Reverse proxy | Caddy |
| Auth provider | Authentik |
| Container | Docker / docker compose |
| Monorepo tasks | Justfile |

New runtime dependencies added to `spine/package.json` or `agent/Cargo.toml` MUST be
evaluated for self-hosting compatibility (no required cloud accounts or external APIs).

## Development Workflow

- All changes MUST be made on feature branches and merged via pull request.
- Spine tests (`bun test`) MUST pass before merge.
- Surface unit and e2e tests (`bun run test`) MUST pass before merge.
- `just lint` and `just check` MUST pass before merge.
- Database migrations MUST be additive and tested against the existing schema.
- The monorepo Justfile is the single source of truth for build, test, lint, and format
  commands. Component-level commands are permitted during development but CI uses `just`.
- Commits MUST be descriptive and conventionally scoped (e.g., `feat(spine):`, `fix(surface):`).

## Governance

This constitution supersedes all other development practices within the Lattice project.

Amendment procedure:
1. Identify the principle or section to change and the motivation.
2. Update this file with the revised content.
3. Increment `CONSTITUTION_VERSION` per semantic versioning:
   - MAJOR: principle removal or redefinition
   - MINOR: new principle or section
   - PATCH: clarification or wording fix
4. Update `LAST_AMENDED_DATE` to the ISO date of the change.
5. Propagate changes to dependent templates per the Sync Impact Report format.
6. Commit with message: `docs: amend constitution to vX.Y.Z (<summary>)`.

All PRs and feature plans MUST pass the Constitution Check gate in `plan-template.md`
before implementation begins. Violations require a Complexity Tracking entry with
justification; unjustified violations block merge.

The project owner (Robert Hamilton) is the sole ratifying authority.

**Version**: 1.0.0 | **Ratified**: 2026-05-23 | **Last Amended**: 2026-05-23
