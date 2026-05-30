# Implementation Plan: Annotations and Diagram Authoring

**Branch**: `014-annotations-diagrams` | **Date**: 2026-05-29 | **Spec**: `specs/014-annotations-diagrams/spec.md`

**Input**: Feature specification from `specs/014-annotations-diagrams/spec.md`

**Note**: This template is filled in by the `/speckit-plan` command. See `.specify/templates/plan-template.md` for the execution workflow.

## Summary

Add text annotations to all readable document kinds and Mermaid diagram authoring to working docs. The implementation will add a local SQLite-backed annotation model, browser-authenticated `/api/annotations` REST routes, QMD annotation indexing that points search results back to original targets, Surface reading controls for highlight/comment/delete, and a minimal working-doc insert-diagram action that uses the existing Markdown/Mermaid rendering path.

## Technical Context

**Language/Version**: TypeScript on Bun for `spine/`; Svelte 5 + TypeScript for `surface/`; no `agent/` Rust changes planned.

**Primary Dependencies**: Elysia, `bun:sqlite`, `@tobilu/qmd`, SvelteKit static SPA, TanStack Query, CodeMirror 6, existing `marked`/Mermaid/DOMPurify rendering stack.

**Storage**: Local SQLite via numbered forward-only migration `spine/migrations/012_annotations.sql`; QMD annotation markdown files under the existing database-owned search index area.

**Testing**: `spine` Bun tests for migration/routes/search indexing; `surface` Vitest/browser tests for annotation UI and diagram insertion; Playwright or manual quickstart validation for end-to-end keyboard and search flows; root `just lint` and `just check` before completion.

**Target Platform**: Existing local-first Lattice deployment: `spine` serves API/static app locally behind Caddy/Auth, `surface` runs as static browser UI.

**Project Type**: Web application with local API service and static browser surface.

**Performance Goals**: Annotation create/revisit under 30 seconds per supported content type; diagram insert+preview under 60 seconds; search for distinctive annotation text returns the annotated source within the normal result set in at least 95% validation attempts.

**Constraints**: No external services, no ORM, no cloud storage, source documents are not modified by annotations, Mermaid only for diagrams, all new browser routes use Authentik-header auth, keyboard operation and WCAG 2.2 AA expectations apply to annotation and diagram controls.

**Scale/Scope**: Single authenticated desktop user; four annotation target kinds (`capture`, `local_file`, `working`, `archive`); working docs only for diagram authoring; no freeform canvas, image annotation, or OCR.

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

Answer each question. Any "Yes" requires a Complexity Tracking entry with justification
before implementation may proceed.

| Principle | Gate Question | Pass / Violation |
|-----------|--------------|-----------------|
| I. Self-Hosting First | Does this feature add a mandatory external service (cloud DB, hosted API, SaaS auth)? | Pass: No external service added. |
| II. Component Boundaries | Does this feature introduce cross-component coupling beyond REST API contracts? | Pass: `surface/` communicates with `spine/` only through `/api/*` contracts. |
| III. Local-First Data | Does this feature store user data outside user-controlled SQLite/local files? | Pass: annotations persist in SQLite and QMD local index files only. |
| IV. Security by Design | Does this feature add a new route group without a declared auth model? | Pass: `/api/annotations` is declared as a browser route guarded by Authentik headers in the existing authenticated group. |
| V. Simplicity over Abstraction | Does this feature introduce an abstraction with fewer than 3 concrete callsites? | Pass: direct route/service functions and existing renderer/editor paths; no new cross-cutting abstraction planned. |
| V. Simplicity over Abstraction | Does this feature introduce an ORM, feature flag, or backwards-compat shim without a shipped external dependency or persisted-data migration requiring it? | Pass: direct `bun:sqlite`; no feature flags or compatibility shims. |
| Tech Stack | Does this feature add a runtime dependency outside the approved technology stack? | Pass: uses existing Mermaid dependency and approved stack. |

## Project Structure

### Documentation (this feature)

```text
specs/014-annotations-diagrams/
├── plan.md              # This file (/speckit-plan command output)
├── research.md          # Phase 0 output (/speckit-plan command)
├── data-model.md        # Phase 1 output (/speckit-plan command)
├── quickstart.md        # Phase 1 output (/speckit-plan command)
├── contracts/           # Phase 1 output (/speckit-plan command)
└── tasks.md             # Phase 2 output (/speckit-tasks command - NOT created by /speckit-plan)
```

### Source Code (repository root)
```text
spine/
├── migrations/012_annotations.sql
├── src/app.ts
├── src/routes/annotations.ts
├── src/search.ts
└── src/**/*.test.ts

surface/
├── src/lib/api/annotations.ts
├── src/lib/types.ts
├── src/components/reading/ReadingPane.svelte
├── src/components/reading/MarkdownRenderer.svelte
├── src/components/editor/EditorPane.svelte
└── src/**/*.test.ts

tests/
└── e2e or integration coverage as needed for annotation/search/diagram flows
```

**Structure Decision**: Use the existing two-component web application structure. `spine/` owns persistence, authenticated REST routes, and QMD indexing; `surface/` owns browser reading/editing UX and calls `spine/` only through `/api/*`. No `agent/` change is required because file watching/indexing behavior is not changing.

## Complexity Tracking

No constitution violations identified.

## Phase 0 Research

Research is captured in `specs/014-annotations-diagrams/research.md`. Key decisions: store annotations in SQLite with direct route/service code, index annotation markdown as a QMD collection that maps back to source targets, keep diagrams as plain fenced Mermaid text in working docs, and require WCAG 2.2 AA keyboard/focus/semantics validation.

## Phase 1 Design

Design artifacts are captured in:

- `specs/014-annotations-diagrams/data-model.md`
- `specs/014-annotations-diagrams/contracts/annotations-api.md`
- `specs/014-annotations-diagrams/contracts/search-contract.md`
- `specs/014-annotations-diagrams/contracts/working-doc-diagrams.md`
- `specs/014-annotations-diagrams/quickstart.md`

Post-design constitution check remains passing: data is local, route auth is declared, contracts preserve component boundaries, no new runtime dependency is introduced, and no speculative abstraction is required.

## Accessibility And Localization Plan

Annotation highlights, note buttons, comment popups, delete controls, diagram insertion, editor focus movement, preview panes, and diagram render errors require WCAG 2.2 AA review. Implementation tasks must include keyboard-only validation, visible focus states, accessible names/descriptions for highlights and notes, semantic association between selected text and comments, non-color-only annotation affordances, and screen-reader-friendly diagram error text.

Bilingual delivery is N/A for this phase because the product is a personal single-user system and the feature spec explicitly assumes no bilingual requirement unless future policy adds one. No user-facing CLI output changes are planned, so CLI accessibility checks are N/A.
