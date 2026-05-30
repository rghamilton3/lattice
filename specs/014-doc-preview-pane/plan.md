# Implementation Plan: Working Doc Preview Pane

**Branch**: `014-doc-preview-pane` | **Date**: 2026-05-29 | **Spec**: [spec.md](./spec.md)

**Input**: Feature specification from `specs/014-doc-preview-pane/spec.md`

**Note**: This template is filled in by the `/speckit-plan` command. See `.specify/templates/plan-template.md` for the execution workflow.

## Summary

Add a rendered markdown preview inside the working document editor. The preview will reuse Surface's existing sanitized markdown rendering path, sit beside the CodeMirror source editor on sufficiently wide layouts, adapt to a stacked/collapsed narrow layout, and track a clear freshness state so users know whether the preview reflects saved content or unsaved edits.

## Technical Context

**Language/Version**: TypeScript 6.0.2, Svelte 5.55.2, SvelteKit 2.57.0

**Primary Dependencies**: SvelteKit static SPA, Svelte 5 runes, TanStack Svelte Query, CodeMirror 6 markdown editor, existing `MarkdownRenderer.svelte` using `marked`, `dompurify`, KaTeX, and Mermaid

**Storage**: N/A; preview derives from working document content already fetched/saved through existing `/api/working/:slug` endpoints and does not change persisted data shape

**Testing**: `cd surface && bun run check`; focused browser/unit coverage if Svelte component tests are introduced; existing Playwright e2e via `cd surface && bun run test:e2e` for workbench/editor smoke coverage where feasible; `just check` before merge

**Target Platform**: Browser SPA served by spine static hosting; desktop and narrow responsive browser viewports

**Project Type**: Monorepo web application, Surface-only UI feature

**Performance Goals**: Preview reflects successful saves within 2 seconds for documents up to 25,000 characters; editing remains responsive while autosave and preview refresh state update

**Constraints**: No new runtime dependency unless implementation proves existing renderer cannot satisfy acceptance criteria; no spine route, migration, auth, or API contract changes; no source mutation as a render side effect; no page-level horizontal scrolling at narrow widths; WCAG 2.2 AA for keyboard operation, focus visibility, status communication, reflow, and contrast; no bilingual delivery required for this English-only UI copy

**Scale/Scope**: One working-document editor component and related Surface tests/docs; markdown preview for common structures and existing rich markdown renderer behavior

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

Answer each question. Any "Yes" requires a Complexity Tracking entry with justification
before implementation may proceed.

| Principle | Gate Question | Pass / Violation |
|-----------|--------------|-----------------|
| I. Self-Hosting First | Does this feature add a mandatory external service (cloud DB, hosted API, SaaS auth)? | Pass - no new service; preview uses client-side rendering of existing document content |
| II. Component Boundaries | Does this feature introduce cross-component coupling beyond REST API contracts? | Pass - Surface continues to use existing `/api/working/*` REST wrappers only |
| III. Local-First Data | Does this feature store user data outside user-controlled SQLite/local files? | Pass - no storage changes; preview state is transient UI state |
| IV. Security by Design | Does this feature add a new route group without a declared auth model? | Pass - no new routes or auth model changes |
| V. Simplicity over Abstraction | Does this feature introduce an abstraction with fewer than 3 concrete callsites? | Pass - plan favors direct editor composition and existing renderer reuse over new abstractions |
| V. Simplicity over Abstraction | Does this feature introduce an ORM, feature flag, or backwards-compat shim without a shipped external dependency or persisted-data migration requiring it? | Pass - no ORM, feature flag, compatibility shim, or migration |
| Tech Stack | Does this feature add a runtime dependency outside the approved technology stack? | Pass - use approved Surface stack and existing markdown rendering dependencies |

## Project Structure

### Documentation (this feature)

```text
specs/014-doc-preview-pane/
├── plan.md              # This file (/speckit-plan command output)
├── research.md          # Phase 0 output (/speckit-plan command)
├── data-model.md        # Phase 1 output (/speckit-plan command)
├── quickstart.md        # Phase 1 output (/speckit-plan command)
├── contracts/           # Phase 1 output (/speckit-plan command)
│   └── editor-preview.md
└── tasks.md             # Phase 2 output (/speckit-tasks command - NOT created by /speckit-plan)
```

### Source Code (repository root)

```text
surface/src/components/editor/EditorPane.svelte      # compose editor, preview, status, responsive layout
surface/src/components/reading/MarkdownRenderer.svelte # reuse sanitized markdown rendering; adjust only if needed for preview semantics
surface/src/lib/api/working.ts                       # existing fetch/save wrapper; no API change planned
surface/e2e/surface.e2e.ts                           # workbench/editor smoke coverage if practical
docs/accessibility/working-docs.md                   # update evidence for preview layout, status, keyboard, reflow
```

**Structure Decision**: Implement entirely in Surface. Keep spine APIs, persistence, and workbench routing unchanged; the feature is a presentation-layer enhancement to the existing working document editor.

## Complexity Tracking

No constitution violations.

## Phase 0: Research

See [research.md](./research.md). Decisions resolve preview refresh timing, renderer reuse, responsive layout, freshness communication, and accessibility/language evidence.

## Phase 1: Design & Contracts

See [data-model.md](./data-model.md), [contracts/editor-preview.md](./contracts/editor-preview.md), and [quickstart.md](./quickstart.md).

## Post-Design Constitution Check

| Principle | Result |
|-----------|--------|
| Self-Hosting First | Pass - no new mandatory service, hosted API, cloud storage, or account requirement |
| Component Boundaries | Pass - Surface uses existing working-document REST wrappers and introduces no direct spine imports |
| Local-First Data | Pass - preview state is transient and saved markdown remains in existing local-first storage |
| Security by Design | Pass - no new route group, auth path, token handling, or privilege boundary |
| Simplicity over Abstraction | Pass - direct editor composition, existing renderer reuse, no feature flags or speculative framework |
| Approved Stack | Pass - no new runtime dependency planned |

## A11Y / Language Plan

- Validate keyboard movement through Back, editor, preview status/control, Save, Delete, and Vim toggle without traps.
- Validate preview freshness is communicated with visible text and polite live-region behavior where status changes matter.
- Validate narrow viewport reflow keeps editing and save controls reachable without page-level horizontal scrolling.
- Validate rendered preview content maintains readable contrast, visible focus for links, and safe overflow for long lines/code blocks.
- Update `docs/accessibility/working-docs.md` with manual and automated evidence for the preview pane.
- Bilingual content work is N/A: Surface working-doc UI is English-only and no multilingual UI contract exists for this feature.
- CLI accessibility checks are N/A: this feature changes browser UI only and no user-facing terminal output.
