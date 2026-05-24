# Tasks — Digest

> **Feature:** spine-api
> **Phase:** tasks
> **Generated at:** 2026-05-24T15:21:37Z
> **Artifact owner:** speckit.product-forge.tasks

## Key decisions

- Created 13 implementation-ready tasks across four groups: captures pagination, files pagination, surface compatibility, and verification.
- Kept the dependency shape tests-first for each backend endpoint, then route implementation, then surface client compatibility, then final verification.
- Marked T005, T009, and T010 as parallelizable because they touch independent files after the relevant contracts are known.
- No XL-sized tasks were created; all tasks are XS, S, or M and should be safe for incremental implementation.
- Used monorepo workspace-prefixed `Paths:` lines for `spine` and `surface` to support portfolio conflict detection.

## Artifacts produced

- `features/spine-api/tasks.md` — dependency-ordered task breakdown for cursor pagination on `/api/captures` and `/api/files`.

## Open risks

- Accepted: `features/spine-api/product-spec/product-spec.md` is absent, so coverage was validated against `spec.md` and the backfilled `product-spec/README.md`.
- Mitigated: response shape changes can break surface callers; T009 and T010 explicitly update the surface API clients.
- Mitigated: cursor privacy risk is tracked by T011 before handoff completion.

## Handoff notes for next phase

- Start implementation with T001 through T004 to deliver `/api/captures` pagination as the MVP, then run the captures route tests before moving to files.
- Recommended commit granularity is captures backend, files backend, surface compatibility, and final verification fixes.
- Run `just test` and `just check` from the repo root when T013 is reached; use `bun test` from `spine/` as the component-level fallback from the plan.
