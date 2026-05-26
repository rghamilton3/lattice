# Implementation Plan: Signal Relay

**Branch**: `feature/time-machine-signal-relay` | **Date**: 2026-05-26 | **Spec**: [spec.md](./spec.md)

**Input**: Feature specification from `/specs/007-signal-relay/spec.md`

## Summary

Harden the optional Signal-to-Lattice relay so phone Note-to-Self messages become captures with reliable parsing, safe attachment reads from mounted signal-cli storage, bounded reconnect behavior, best-effort acknowledgements, and clearer deployment documentation. Keep the relay in the spine process/tooling boundary, reuse the existing agent capture and attachment endpoints, and avoid new runtime services beyond the operator-provided Signal RPC bridge.

## Technical Context

**Language/Version**: TypeScript on Bun for spine relay and parser modules

**Primary Dependencies**: Bun TCP client, built-in `fetch`, existing agent capture/attachment endpoints, signal-cli JSON-RPC protocol over TCP

**Storage**: No new database tables. Signal messages are persisted as existing capture rows; attachment files are read from a configured local mount and uploaded through existing capture attachment storage.

**Testing**: `bun test tests/unit/signal-messages.test.ts tests/unit/signal-relay.test.ts` in `spine`; docs review for README/compose setup

**Target Platform**: Self-hosted Linux/VPS deployment running spine and a Signal RPC service reachable over loopback or host networking

**Project Type**: Background relay process inside the spine package plus operator documentation

**Performance Goals**: Process one incoming frame synchronously enough to post a capture promptly; avoid duplicate reconnect attempts during outages; avoid loading attachments unless a capture has already been saved

**Constraints**: No new runtime dependencies; relay must use bearer-token agent auth only; spine remains local-first source of truth; attachment file reads must be path-confined; no live signal-cli service in automated tests; CLI/log output must remain plain text and readable

**Scale/Scope**: Single-user Note-to-Self relay. Multi-account Signal ingestion, group capture, two-way chat workflows, live signal-cli integration tests, and UI changes are out of scope.

## Constitution Check

_GATE: Must pass before Phase 0 research. Re-check after Phase 1 design._

| Principle                      | Gate Question                                                                    | Pass / Violation                                                                             |
| ------------------------------ | -------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------- |
| I. Self-Hosting First          | Does this feature add a mandatory external hosted service?                       | Pass - Signal RPC is operator-run/local and optional                                         |
| II. Component Boundaries       | Does this feature introduce cross-component coupling beyond REST/API boundaries? | Pass - relay posts to existing agent endpoints                                               |
| III. Local-First Data          | Does this feature store user data outside user-controlled systems?               | Pass - captures and attachments end in local spine storage                                   |
| IV. Security by Design         | Does this feature add auth bypasses or unsafe file reads?                        | Pass with requirement - bearer token remains required and attachment reads are path-confined |
| V. Simplicity over Abstraction | Does this introduce unnecessary abstractions/dependencies?                       | Pass - direct helpers in existing relay/parser modules, no dependencies                      |
| Tech Stack                     | Does this add runtime dependencies outside the approved stack?                   | Pass - none planned                                                                          |

## Project Structure

### Documentation (this feature)

```text
specs/007-signal-relay/
├── plan.md
├── research.md
├── data-model.md
├── quickstart.md
├── contracts/
│   └── signal-relay.md
├── checklists/
│   └── requirements.md
└── tasks.md

docs/accessibility/
└── signal-relay.md
```

### Source Code (repository root)

```text
spine/
├── src/
│   ├── signal-relay.ts
│   └── signal/
│       └── messages.ts
├── docker-compose.relay.yml
└── tests/
    └── unit/
        ├── signal-messages.test.ts
        └── signal-relay.test.ts

README.md
```

**Structure Decision**: Keep parsing logic in `spine/src/signal/messages.ts` and relay operational/file-posting helpers in `spine/src/signal-relay.ts`. Tests can cover pure parsing and exported relay helpers without requiring a live Signal RPC socket.

## Complexity Tracking

No constitution violations.

## Phase 0 Research

See [research.md](./research.md). Decisions: accept only Note-to-Self frames, preserve current local Signal RPC bridge, use path-confined attachment reads, keep capture-before-attachment sequencing, and document relay setup/accessibility evidence.

## Phase 1 Design

See [data-model.md](./data-model.md), [contracts/signal-relay.md](./contracts/signal-relay.md), and [quickstart.md](./quickstart.md).

## Post-Design Constitution Check

Re-check passes. The design adds no hosted dependency, no database migrations, no ORM, and no new runtime package. Security-sensitive attachment reads are explicitly constrained to a canonical base directory. Accessibility work is documentation/log-output evidence only; bilingual content remains N/A because the project docs and relay diagnostics are English-only.
