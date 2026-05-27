# Research: Tracking Phase 0

## Decision: Store Tracking Records In Spine SQLite

**Rationale**: The Lattice constitution makes spine the owner of structured user data, and `docs/tracking-development-plan.md` defines `tracks` and `track_queries` as spine tables. SQLite via `bun:sqlite` matches existing migrations, tests, backups, and deployment.

**Alternatives considered**: A separate inventory database was rejected because it adds infrastructure and backup burden. Browser storage was rejected because tracking records are user data that must survive across clients. QMD-only storage was rejected because Phase 0 needs durable append-only records with metadata and query logging.

## Decision: Use Direct SQL And A Forward-Only Migration

**Rationale**: Existing spine schema changes live in numbered SQL migrations. `011_tracks.sql` follows the existing archive migration without sharing a migration number. Direct SQL preserves the no-ORM constitution rule and keeps the implementation easy to inspect.

**Alternatives considered**: An ORM or repository layer was rejected as premature abstraction. A hand-edited database was rejected because migrations are the canonical schema.

## Decision: Add `/api/agent/track` Under Existing Agent Auth

**Rationale**: HA Voice, Tasker, Signal relay, and future agents are write clients analogous to `/api/agent/capture`. The existing bearer-token guard already defines the correct authorization posture for non-browser automated clients.

**Alternatives considered**: Exposing track writes under browser Authentik auth was rejected because device clients do not have browser sessions. Adding a new token scheme was rejected as unnecessary.

## Decision: Add Authenticated `/api/tracks/*` Browser Routes

**Rationale**: Search and result-open logging return user tracking data and fit the existing Surface/API auth model. Keeping these outside `/api/agent/*` prevents bearer-token clients from becoming the default read path.

**Alternatives considered**: Using `/api/search` was rejected because tracking search has different result shape and query logging semantics. Returning records from the write endpoint only was rejected because Phase 0 requires round-trip retrieval.

## Decision: Use Keyword Search For Phase 0

**Rationale**: Phase 0 only needs a record written during setup to be found by a word from its text. SQLite `LIKE` with newest-first ordering is enough for the initial data volume and avoids premature FTS/QMD integration. FTS5 can be introduced later if simple matching becomes insufficient.

**Alternatives considered**: QMD semantic retrieval was rejected because it is explicitly Phase 5+ in the tracking plan. FTS5 was deferred unless tests or early use show `LIKE` is inadequate.

## Decision: Preserve Free-Form Text Without Item/Location Parsing

**Rationale**: The core product rule is frictionless capture. Parsing item, location, tags, zones, or categories at write time creates decisions for the user and conflicts with Phase 0 acceptance criteria.

**Alternatives considered**: Structured item/location fields and category prompts were rejected. Lightweight duplicate detection is deferred to later phases.

## Decision: Model Displacement As A Boolean Set By Command Path

**Rationale**: The spec requires normal track and checkout/displaced intent to be determined by the command path, not text parsing. A boolean is enough to distinguish expected-location records from checked-out/displaced records.

**Alternatives considered**: A status enum was rejected because reasons like lent, broken, or in-use belong in free-form text for Phase 0.

## Decision: Keep Supersession Optional And Validated

**Rationale**: Phase 0 is append-only. Optional `supersedes` allows future flows and manually supplied references without requiring automatic reconciliation.

**Alternatives considered**: Auto-supersession was rejected because it needs identity matching not planned until later phases. Ignoring supersession entirely was rejected because the spec allows optional supersession information.

## Decision: Preserve Photo References Only

**Rationale**: Signal photo support in Phase 0 only requires preserving a usable reference while indexing the caption/search text. Image storage/OCR/thumbnail workflows are outside scope.

**Alternatives considered**: OCR and image indexing were rejected as later work. Requiring photos was rejected because Signal photo is optional.

## Decision: Accessibility Evidence Depends On Durable UI Changes

**Rationale**: API routes and external device setup do not create a persistent browser surface. If a minimal Surface search/open UI is added, it must receive accessibility review and evidence; otherwise accessibility evidence is N/A with rationale.

**Alternatives considered**: Creating a new accessibility evidence page for API-only work was rejected as noise. Skipping a11y planning was rejected by governance.

## Decision: Bilingual Delivery Is N/A

**Rationale**: Existing Lattice product/setup copy is English-only and Phase 0 does not include translation resources. The plan still records bilingual scope explicitly.

**Alternatives considered**: Adding translations was rejected as outside Phase 0 and unsupported by the current app content model.
