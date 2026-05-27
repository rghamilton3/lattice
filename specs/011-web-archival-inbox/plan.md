# Implementation Plan: Web Archival And Inbox Evolution

**Branch**: `bionic-narwhal` | **Date**: 2026-05-26 | **Spec**: [spec.md](./spec.md)

**Input**: Feature specification from `/specs/011-web-archival-inbox/spec.md`

## Summary

Make web archives a durable third content category by adding spine-owned archive persistence, two capture paths, quality classification, default-good search behavior, inbox item type expansion, Signal attention routing, and Surface review actions. The design keeps pending state in spine/surface, stores archive bytes in local filesystem storage beside the SQLite database, indexes extracted text through QMD, uses the existing bearer-token `/api/agent/*` boundary for trusted capture clients, and avoids a new queue service by using an in-process v1 URL archive worker.

## Technical Context

**Language/Version**: TypeScript on Bun for spine; TypeScript with Svelte 5 runes and SvelteKit 2 for surface

**Primary Dependencies**: Elysia, `bun:sqlite`, `@tobilu/qmd`, local filesystem storage, stock SingleFile browser extension posting saved HTML, local `monolith` CLI invoked by spine, existing Signal relay helpers, TanStack Svelte Query, Tailwind CSS v4

**Storage**: Additive SQLite migration for `archives`; archive HTML bytes under the database directory's `web/` area or configured production equivalent such as `/var/lib/lattice/web/<hash>.html`; markdown index files for archive extracted text under QMD-managed source directories

**Testing**: Spine `bun test` for archive storage/classification/routes/search mapping/notification decisions; Surface `bun run check`, `bun run test:unit`, and targeted Playwright coverage for inbox action rows and notification posture behavior; root `just check` and `just lint` before merge where feasible

**Target Platform**: Self-hosted Linux/VPS spine deployment behind Caddy + Authentik plus desktop browser extension clients and mobile URL-only share sources

**Project Type**: Full-stack monorepo feature across spine REST/storage/search, surface inbox UI, and local relay integration

**Performance Goals**: SingleFile upload stores and indexes without blocking unrelated API requests; URL-only jobs time out around 30 seconds; inbox queries remain fast for normal single-user archive counts; search returns only good current archives by default

**Constraints**: No hosted services; no direct database access from surface; new route auth must be declared; no Redis/BullMQ for v1; no ORM; archive storage must be content-addressed and local; failed relay sends must not block archive persistence; degraded technical quality must not encode editorial judgment

**Scale/Scope**: Single-user personal archive with desktop rendered captures, mobile/hotkey/scripted URL-only captures, a small in-process job queue, recent review windows, and existing Signal attention relay. Headless browser rendering, per-site rules, daily digests, and editorial classification are deferred.

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

| Principle | Gate Question | Pass / Violation |
|-----------|---------------|------------------|
| I. Self-Hosting First | Does this feature add a mandatory external service (cloud DB, hosted API, SaaS auth)? | Pass - SingleFile and monolith are local/operator-controlled tools; no hosted service |
| II. Component Boundaries | Does this feature introduce cross-component coupling beyond REST API contracts? | Pass - surface uses `/api/*`; capture clients use `/api/agent/*` |
| III. Local-First Data | Does this feature store user data outside user-controlled SQLite/local files? | Pass - archive metadata is SQLite and bytes stay on local disk |
| IV. Security by Design | Does this feature add a new route group without a declared auth model? | Pass - new `/api/agent/archive-*` routes use bearer token; browser `/api/archives*` routes use Authentik |
| V. Simplicity over Abstraction | Does this feature introduce an abstraction with fewer than 3 concrete callsites? | Pass - shared action row has three immediate item variants: capture, recapture, recent archive |
| V. Simplicity over Abstraction | Does this feature introduce an ORM, feature flag, or backwards-compat shim without a shipped external dependency or persisted-data migration requiring it? | Pass - direct `bun:sqlite`; additive migration only |
| Tech Stack | Does this feature add a runtime dependency outside the approved technology stack? | Violation - local `monolith` CLI is a new server-side tool |

## Project Structure

### Documentation (this feature)

```text
specs/011-web-archival-inbox/
├── spec.md
├── plan.md
├── research.md
├── data-model.md
├── quickstart.md
├── contracts/
│   └── web-archival-inbox.md
├── checklists/
│   └── requirements.md
└── tasks.md

docs/accessibility/
└── web-archival-inbox.md
```

### Source Code (repository root)

```text
spine/
├── migrations/
│   └── 010_archives.sql
├── src/
│   ├── archives.ts
│   ├── archiveJobs.ts
│   ├── archiveQuality.ts
│   ├── archiveEvents.ts
│   ├── search.ts
│   ├── signal/
│   │   └── messages.ts
│   └── routes/
│       ├── agent.ts
│       ├── archives.ts
│       ├── captures.ts
│       └── search.ts
└── tests/
    ├── unit/
    │   ├── archives.test.ts
    │   ├── archiveQuality.test.ts
    │   └── archiveNotifications.test.ts
    └── integration/
        └── archive-routes.test.ts

surface/
├── src/lib/
│   ├── api/archives.ts
│   └── types.ts
├── src/components/home/
│   └── InboxList.svelte
├── src/components/inbox/
│   └── ActionRow.svelte
├── src/components/overlays/
│   └── Settings.svelte
└── e2e/
    └── surface.e2e.ts

README.md
docker-compose.yml
```

**Structure Decision**: Keep archive persistence, classification, job execution, search integration, and notification decisions in `spine/`; keep all user review and action-row UI in `surface/`; do not add a new package, queue service, browser extension fork, or shared monorepo library for v1.

## Complexity Tracking

| Violation | Why Needed | Simpler Alternative Rejected Because |
|-----------|------------|-------------------------------------|
| New local `monolith` CLI dependency | URL-only archive requests from mobile, hotkeys, and scripts need a self-hosted way to fetch and package pages without a desktop browser. | Storing URLs only fails the durability goal; building an archiver in TypeScript would be more complex and less proven; adding a headless browser has higher ops cost and is explicitly deferred. |

## Phase 0: Research

See [research.md](./research.md). Decisions cover capture paths, archive storage, URL worker strategy, quality heuristics, supersession, inbox item modeling, Signal attention posture, and SingleFile rollout.

## Phase 1: Design & Contracts

See [data-model.md](./data-model.md), [contracts/web-archival-inbox.md](./contracts/web-archival-inbox.md), and [quickstart.md](./quickstart.md).

## Post-Design Constitution Check

| Principle | Result |
|-----------|--------|
| Self-Hosting First | Pass - all content and archive bytes stay on user-controlled spine storage; no hosted dependency added |
| Component Boundaries | Pass - capture clients, surface, and spine communicate through documented REST contracts only |
| Local-First Data | Pass - SQLite metadata plus local archive files; QMD remains library-managed |
| Security by Design | Pass - auth model is declared for each new route group; archive file reads are path-confined by ID/hash lookup |
| Simplicity over Abstraction | Pass with tracked exception - in-process URL queue and direct DB access; shared action row has three concrete variants |
| Approved Stack | Tracked violation - `monolith` CLI justified as a local system tool for URL-only durable capture |

## A11Y / Language Plan

- Document keyboard coverage for shared action rows, recapture/recent-review shortcuts, focus handling when opening a recapture URL, and settings posture controls in `docs/accessibility/web-archival-inbox.md`.
- Verify action labels are positive verbs, Skip is always available, and no copy introduces overdue, streak, or debt language.
- Use existing Surface automated checks plus targeted keyboard tests for inbox action rows where feasible.
- Bilingual content work is N/A for this feature because Surface currently ships English-only product copy and no translation resources.
