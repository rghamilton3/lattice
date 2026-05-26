# Implementation Plan: Agent Indexer

**Branch**: `feature/time-machine-agent-indexer` | **Date**: 2026-05-26 | **Spec**: [spec.md](./spec.md)

**Input**: Feature specification from `/specs/008-agent-indexer/spec.md`

## Summary

Deliver the local Rust file indexer and spine ingestion/status surfaces so configured watch directories are polled, supported files are extracted, unchanged files are skipped from a local cache, changed text is posted to spine, and operators can diagnose agent health. Keep the agent local-first, use bearer-token `/api/agent/*` contracts only, store extracted text/metadata in existing spine SQLite tables and QMD-backed markdown files, and avoid hosted services or new runtime dependencies.

## Technical Context

**Language/Version**: Rust 2024 edition for the local agent; TypeScript on Bun for spine routes and tests

**Primary Dependencies**: Existing Rust crates `reqwest`, `tokio`, `rusqlite`, `walkdir`, `glob`, `mime_guess`, `blake3`, `tracing`; existing Bun/Elysia route stack and QMD search helpers

**Storage**: Local agent cache SQLite at the platform data directory; spine SQLite migrations for `file_index` and `agent_status`; QMD-managed vector database remains managed by `@tobilu/qmd`

**Testing**: `cargo test` and targeted Rust unit tests in `agent`; `bun test tests/routes/agent.test.ts` in `spine`

**Target Platform**: User-controlled Linux desktop/laptop for the user-level service; spine remains the self-hosted VPS/server target

**Project Type**: Local background CLI/service plus spine REST ingestion/status routes

**Performance Goals**: Skip unchanged files without rereading contents; process 1,000 small supported files in one scan without crashing; keep network calls bounded to changed files and status heartbeats

**Constraints**: No hosted indexing service; no local vector index; bearer-token auth only for agent routes; no new runtime dependency unless already present; plain text diagnostics; path scanning must not follow symlinks; large files are skipped by configurable byte limit

**Scale/Scope**: Single-user local agents across personal machines, initially proven on one machine. Rich Office extraction, file opening, on-demand fetch, per-machine token rotation, and UI redesign are out of scope.

## Constitution Check

_GATE: Must pass before Phase 0 research. Re-check after Phase 1 design._

| Principle                      | Gate Question                                                                    | Pass / Violation                                                                 |
| ------------------------------ | -------------------------------------------------------------------------------- | -------------------------------------------------------------------------------- |
| I. Self-Hosting First          | Does this feature add a mandatory external service?                              | Pass - agent and spine are user-run; `pdftotext` is local tooling only            |
| II. Component Boundaries       | Does this feature introduce cross-component coupling beyond REST API contracts?   | Pass - agent communicates with spine only through `/api/agent/index` and status   |
| III. Local-First Data          | Does this feature store user data outside user-controlled SQLite/local files?     | Pass - extracted text lives in spine SQLite/markdown and source files stay local  |
| IV. Security by Design         | Does this feature add a new route group without a declared auth model?            | Pass - all agent routes use existing bearer-token auth                            |
| V. Simplicity over Abstraction | Does this feature introduce an abstraction with fewer than 3 concrete callsites?  | Pass - direct scan/cache/extract modules match concrete responsibilities          |
| V. Simplicity over Abstraction | Does this feature add ORM/flags/compat shims without persisted-data need?         | Pass - direct SQLite and forward-only migrations                                  |
| Tech Stack                     | Does this feature add a runtime dependency outside the approved technology stack? | Pass - uses existing approved Rust agent and Bun spine stacks                     |

## Project Structure

### Documentation (this feature)

```text
specs/008-agent-indexer/
├── plan.md
├── research.md
├── data-model.md
├── quickstart.md
├── contracts/
│   └── agent-indexer.md
└── tasks.md

docs/accessibility/
└── agent-indexer.md
```

### Source Code (repository root)

```text
agent/
├── Cargo.toml
├── lattice-agent.service
└── src/
    ├── main.rs
    ├── lib.rs
    ├── config.rs
    ├── scan.rs
    ├── extract.rs
    ├── cache.rs
    └── time.rs

spine/
├── migrations/
│   ├── 002_file_index.sql
│   └── 007_agent_status.sql
├── src/routes/agent.ts
└── tests/routes/agent.test.ts
```

**Structure Decision**: Keep local-only polling, extraction, and cache state inside `agent/src/*`; keep persistence, indexing markdown generation, and status records inside spine route/migration files. The wire boundary remains documented JSON over `/api/agent/*`.

## Complexity Tracking

No constitution violations.

## Phase 0 Research

See [research.md](./research.md). Decisions: use polling instead of filesystem notifications, BLAKE3 plus metadata cache for dedupe, local SQLite for cache durability, direct text plus `pdftotext` extraction, and spine-owned embedding/index refresh.

## Phase 1 Design

See [data-model.md](./data-model.md), [contracts/agent-indexer.md](./contracts/agent-indexer.md), and [quickstart.md](./quickstart.md).

## Post-Design Constitution Check

Re-check passes. The design adds no hosted services, preserves agent/spine REST boundaries, stores data only in user-controlled local/spine files, uses existing bearer-token authentication, and keeps diagnostics accessible as plain text. Bilingual delivery remains N/A because no translated UI copy is introduced.
