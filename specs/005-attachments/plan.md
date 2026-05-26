# Implementation Plan: Attachments

**Branch**: `feature/time-machine-attachments` | **Date**: 2026-05-26 | **Spec**: [spec.md](./spec.md)

**Input**: Feature specification from `/specs/005-attachments/spec.md`

## Summary

Deliver the local attachment workflow across spine and surface: authenticated users can attach files to captures and working documents, list/open/delete those files from the workbench, preview PDFs where supported, and surface attachment metadata in retrieval. Use existing SQLite attachment tables, local attachment storage, markdown metadata index files, QMD refresh hooks, and Svelte/TanStack Query UI state; no new runtime dependencies or external storage services.

## Technical Context

**Language/Version**: TypeScript on Bun for spine; TypeScript/Svelte 5 for surface

**Primary Dependencies**: Elysia, SQLite via `bun:sqlite`, `@tobilu/qmd`, SvelteKit static SPA, TanStack Query, existing `pdfjs-dist`

**Storage**: User-controlled SQLite (`capture_attachments`, `working_attachments`) plus local binary files under the configured attachment directory and local markdown metadata index files beside the spine database

**Testing**: `bun test tests/routes/attachments.test.ts tests/routes/working-attachments.test.ts tests/routes/search.test.ts` in `spine`; `bun run check` in `surface`

**Target Platform**: Self-hosted Lattice deployment on Linux/VPS; local development via Bun/Vite

**Project Type**: Full-stack web app with spine REST API and surface SPA UI

**Performance Goals**: Keep attachment operations single-file and parent-scoped; avoid unbounded parent list queries from user input; refresh retrieval metadata after upload/delete without blocking unrelated parent views

**Constraints**: Authentik fail-closed for browser routes; bearer auth remains agent-only; no external object storage; no ORM; no new runtime dependencies; raw file serving must enforce canonical-path safety; UI controls must remain keyboard accessible and documented against WCAG 2.2 AA

**Scale/Scope**: Single-user local-first attachment management for captures and working documents; multi-file upload, virus scanning, OCR, and arbitrary binary text extraction remain out of scope

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

| Principle | Gate Question | Pass / Violation |
|-----------|--------------|-----------------|
| I. Self-Hosting First | Does this feature add a mandatory external service (cloud DB, hosted API, SaaS auth)? | Pass - uses local SQLite/files/QMD only |
| II. Component Boundaries | Does this feature introduce cross-component coupling beyond REST API contracts? | Pass - surface uses `/api/captures/:id/attachments` and `/api/working/:slug/attachments` only |
| III. Local-First Data | Does this feature store user data outside user-controlled SQLite/local files? | Pass - binaries and metadata remain local |
| IV. Security by Design | Does this feature add a new route group without a declared auth model? | Pass - existing user routes remain Authentik-protected; agent attachment ingest remains bearer-protected |
| V. Simplicity over Abstraction | Does this feature introduce an abstraction with fewer than 3 concrete callsites? | Pass - keep direct route/API/component changes |
| V. Simplicity over Abstraction | Does this feature introduce an ORM, feature flag, or backwards-compat shim without a shipped external dependency or persisted-data migration requiring it? | Pass - direct SQLite and no feature flags/shims |
| Tech Stack | Does this feature add a runtime dependency outside the approved technology stack? | Pass - no new dependencies |

## Project Structure

### Documentation (this feature)

```text
specs/005-attachments/
├── plan.md
├── research.md
├── data-model.md
├── quickstart.md
├── contracts/
│   └── attachments.md
├── checklists/
│   └── requirements.md
└── tasks.md

docs/accessibility/
└── attachments.md
```

### Source Code (repository root)

```text
spine/
├── src/
│   ├── routes/
│   │   ├── attachments.ts
│   │   └── working.ts
│   └── search.ts
├── migrations/
│   ├── 003_capture_attachments.sql
│   ├── 008_attachment_upload_source.sql
│   └── 009_working_attachments.sql
└── tests/routes/
    ├── attachments.test.ts
    ├── working-attachments.test.ts
    └── search.test.ts

surface/
└── src/
    ├── lib/api/attachments.ts
    └── components/
        ├── overlays/FileUpload.svelte
        └── reading/
            ├── AttachmentRail.svelte
            ├── PdfViewer.svelte
            └── ReadingPane.svelte
```

**Structure Decision**: Use existing spine route modules, migration files, search metadata helpers, and surface reading/upload components. Attachment state crosses component boundaries only as JSON and file responses over `/api/*`; binary files and QMD metadata remain encapsulated in spine.

## Complexity Tracking

No constitution violations.

## Phase 0 Research

See [research.md](./research.md). Decisions: keep local binary storage with SQLite metadata, preserve separate capture and working attachment schemas, index metadata as markdown for QMD, serve raw files with canonical-path checks, and document accessibility evidence for upload/rail/preview controls.

## Phase 1 Design

See [data-model.md](./data-model.md), [contracts/attachments.md](./contracts/attachments.md), and [quickstart.md](./quickstart.md).

## Post-Design Constitution Check

Re-check passes. The design adds no external services, dependencies, ORMs, or cross-component imports; all user data remains in local SQLite/files and QMD-managed local storage. Accessibility review work is planned in `docs/accessibility/attachments.md`; bilingual content work is explicitly N/A because no user-facing non-English surface exists in this project phase. CLI accessibility checks are N/A because no user-facing terminal output changes.
