# Research: Tracking Surface Integration

## Decision: Keep item cards derived, persist only manual bins

**Rationale**: The existing tracking model is append-only and newest-wins. A canonical item table would imply identity certainty, merge semantics, and lifecycle rules that Phase 4 explicitly avoids. Manual bins need durable state because users can create an empty or future-use bin that is not yet represented by a track.

**Alternatives considered**: A full `tracked_items` table was rejected because fuzzy duplicates must remain separate until explicit merge. Purely derived bins were rejected because manually-created empty bins would disappear. A generic kanban board framework was rejected because board reuse for other content is deferred.

## Decision: Add `track_bins` as an additive local SQLite migration

**Rationale**: Existing `tracks` rows can represent item locations but not durable empty/manual bin names. A small `track_bins` table with name, normalized name, timestamps, and archived state preserves local-first storage and supports lazy/manual bins without changing track immutability.

**Alternatives considered**: Encoding manual bins as synthetic tracks was rejected because it pollutes item history with non-observation rows. Browser-local bins were rejected because board organization should survive devices/sessions behind the same self-hosted Spine.

## Decision: Add Authentik-protected browser track creation under `/api/tracks`

**Rationale**: Surface-created tracks must use browser auth, not the agent bearer-token route. A browser `POST /api/tracks` can reuse the same validation and insert semantics as `/api/agent/track` while stamping `source` values such as `surface-form`, `surface-drag`, `surface-board`, and `surface-followup`.

**Alternatives considered**: Calling `/api/agent/track` from Surface was rejected because it crosses the auth boundary. Creating records only through follow-up endpoints was rejected because the spec requires standalone surface form and board moves.

## Decision: Store browser photo uploads as local track photos referenced by `photo_ref`

**Rationale**: `tracks.photo_ref` already exists. A focused browser photo upload endpoint can store image files under user-controlled local storage, return an opaque `photo_ref`, and serve thumbnails/raw images through authenticated `/api/tracks/photos/:ref` routes using the existing attachment route's path-safety pattern.

**Alternatives considered**: Reusing capture attachments was rejected because a track may not belong to a capture. Storing binary blobs in SQLite was rejected because existing attachment storage uses local files. OCR or image analysis was rejected as deferred scope.

## Decision: Add stable record detail endpoint and Surface pane state

**Rationale**: The spec requires stable item-history links. Surface is a static SPA, so the stable URL can encode tracking detail state and hydrate into a `track` pane, while Spine supplies `GET /api/tracks/:id` with selected record, same-item history, and related location records.

**Alternatives considered**: Search-only result expansion was rejected because browser history and saved links need a durable target. Server-rendered `/track/:id` pages were rejected because Surface is an adapter-static SPA with no SSR.

## Decision: Derive board cards from newest useful matching records and expose move actions as append-only records

**Rationale**: The source plan says newest record wins, no multi-bin items, and moves create new tracking records. Board summaries can group derived item phrases into one current card each, keeping unclear phrases in `Unbinned` and displaced items visible with a filter. Moving to a bin creates text `<item phrase> in <bin name>`, `source: "surface-drag"` or keyboard equivalent source, `displaced: false`, and `supersedes` the previous current record.

**Alternatives considered**: Persisting card positions separately was rejected because it would create a second source of truth. Drag-to-merge was rejected by the spec. Multi-bin membership was rejected because newest-wins current location is the desired mental model.

## Decision: Present displaced items in their last-known bin with a strong indicator and filter

**Rationale**: Keeping displaced cards near their last known location preserves spatial context and avoids creating a second board lane that competes with the newest-wins location model. The displaced-only filter satisfies quick retrieval and review needs.

**Alternatives considered**: A dedicated `Checked Out` lane was considered but rejected for initial design because it hides where the item normally belongs. Implementation can still revisit this if usability review shows the indicator/filter is unclear.

## Decision: Surface follow-ups as action rows in the tracking workspace and home context

**Rationale**: Phase 1 already derives follow-ups from `track_queries`. Phase 4 should render them in Surface with affirmative labels from the API (`Still there`/`Still out`), moved-entry flow, and skip. Follow-ups must remain dismissible and non-accumulating.

**Alternatives considered**: Creating a separate prompt table was rejected because existing query lifecycle state covers eligibility and closure. Counts, badges, overdue language, and backlog wording were rejected by the source-plan principle.

## Decision: Accessibility evidence is required; bilingual delivery is not

**Rationale**: This feature changes several browser UI flows: search, form, photo upload, board organization, filters, status messages, and action rows. WCAG 2.2 AA evidence should be updated under `docs/accessibility/`. Current Surface copy and the provided tracking plan are English-only with no translation workflow.

**Alternatives considered**: Deferring accessibility evidence was rejected because board movement and photo upload are high-risk interaction patterns. Bilingual delivery was rejected as out of scope for this milestone.
