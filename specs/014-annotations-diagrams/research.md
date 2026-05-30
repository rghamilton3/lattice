# Research: Annotations and Diagram Authoring

## Annotation Persistence

Decision: Add `spine/migrations/012_annotations.sql` with a single `annotations` table using `id`, `target_kind`, `target_id`, optional selection offsets/text, `comment`, `created_at`, and `updated_at`.

Rationale: This matches the Phase 7 data model, keeps user-authored comments in user-owned SQLite, and follows existing forward-only migration practice without adding an ORM.

Alternatives considered: Embedding annotations into source documents was rejected because annotations must not modify captures, local files, working docs, or archives. Separate per-target tables were rejected because the feature requires uniform annotation behavior across all supported document kinds.

## API Shape And Auth

Decision: Implement browser-authenticated `POST /api/annotations`, `GET /api/annotations?target_kind=...&target_id=...`, and `DELETE /api/annotations/:id` inside the existing Authentik-guarded browser route group.

Rationale: The API is small, testable, and preserves the `surface/` to `spine/` boundary through REST contracts. Annotation routes are user-facing browser routes, not `/api/agent/*` ingestion routes.

Alternatives considered: Agent-owned annotation ingestion was rejected because annotations are created interactively in Surface. A generic notes API was rejected as premature abstraction.

## Search Indexing

Decision: Add an annotation QMD collection whose generated markdown contains annotation comment text, selected text, target kind/id, and a stable annotation id; map matches back to the original annotated target with annotation context.

Rationale: QMD already indexes local markdown files for captures, local files, attachments, working attachments, and archives. A dedicated annotation collection lets deleted annotations be removed from search and lets search results explain annotation-only matches.

Alternatives considered: Appending comments to source markdown was rejected because annotations must not mutate source content or blur whether text came from source or user comment. SQLite-only search was rejected because the requirement is to use the existing search experience.

## Surface Annotation UX

Decision: Load annotations in `ReadingPane.svelte` for the active readable target, use selected text plus offsets when available for creation, render highlights and associated marginal notes in reading content, and keep delete/comment controls keyboard reachable.

Rationale: `ReadingPane.svelte` already owns the active capture/file/working/archive reading experience and existing selection helpers, so it is the smallest integration point.

Alternatives considered: A separate annotation workspace was rejected because users need annotations in context. Pointer-only popovers were rejected by the keyboard operability and WCAG requirements.

## Mermaid Diagram Authoring

Decision: Keep diagrams as plain fenced `mermaid` blocks in working-doc markdown. Add an editor command that inserts a starter fenced block at the cursor; rely on the existing Mermaid rendering path for preview and inline display.

Rationale: Mermaid is already a dependency, markdown is already the working-doc storage format, and plain text diagrams remain searchable without a new data model.

Alternatives considered: A separate diagram table was rejected because diagrams are document content. Freeform canvas and image/OCR workflows are out of scope.

## Accessibility And Localization

Decision: Plan WCAG 2.2 AA validation for annotation controls, highlight semantics, note association, popups, diagram insertion, preview, and errors. Bilingual delivery is not planned for this phase.

Rationale: The feature adds user-facing controls and visual annotations. The spec assumes a personal single-user system with no current bilingual requirement.

Alternatives considered: Deferring accessibility validation was rejected because the spec requires keyboard operation and no known WCAG blockers.
