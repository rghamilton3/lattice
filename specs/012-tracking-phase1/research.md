# Research: Tracking Phase 1

## Decision: Derive Follow-Ups From `track_queries`

**Decision**: Use Phase 0's `track_queries` rows as the follow-up source of truth. A pending follow-up is a query row with non-null `opened_track_id`, null `loop_closed_at`, queried within the follow-up window, old enough to ask, not expired, and not superseded by a newer matching track.

**Rationale**: The query row already records the event that makes loop closure meaningful: the user searched and opened a result. Reusing `loop_closed_at` and `loop_outcome` keeps Phase 1 minimal, append-only for tracks, and avoids a separate prompt queue that could accumulate visible debt.

**Alternatives considered**: A separate `track_followups` table was rejected for Phase 1 because it adds state duplication and prompt lifecycle complexity before real use proves the need. In-memory prompt generation was rejected because outcomes must persist across restarts and deployments.

## Decision: Use Development-Plan Timing Defaults

**Decision**: Follow the development plan defaults: queries from the past 14 days are eligible, prompts become eligible after at least 12 hours, and unanswered prompts expire 14 days after query time with `loop_outcome = 'expired'` and `loop_closed_at` set when expiration is processed.

**Rationale**: The spec explicitly assumes the development-plan loop timing. These values are specific enough for implementation and testing while staying lightweight for a single-user prototype.

**Alternatives considered**: Configurable per-user timing was rejected as premature. Shorter displaced-item timing is documented as a v2+ prompt refinement and remains out of scope.

## Decision: Suppress Follow-Ups With Lightweight Text Matching

**Decision**: Suppress a pending follow-up when a newer track after the query appears to match the opened record or original query using the same lightweight keyword/key-phrase strategy used for Phase 1 retrieval and duplicate hints.

**Rationale**: The requirement is to avoid asking about an item that has already been tracked again. Perfect identity resolution would require taxonomy, item parsing, or semantic retrieval, all explicitly deferred. A conservative keyword match is acceptable because a false negative only creates a dismissible offer and a false positive avoids an unnecessary prompt.

**Alternatives considered**: Parsed item identity was rejected because tracking must stay free-form. Semantic QMD matching was rejected because semantic retrieval is deferred to Phase 5+.

## Decision: Improve Keyword Retrieval Without QMD

**Decision**: Keep retrieval in spine SQLite with direct keyword matching. Split ordinary wording into useful search tokens, prefer rows matching more tokens, order primary results by match quality and recency, and keep older matching records visible as history.

**Rationale**: Phase 1 needs a dependable workflow, not final retrieval quality. Token-based keyword matching improves over a raw substring query enough to support questions like "where is the drill" finding "drill is on the shelf" without introducing semantic infrastructure.

**Alternatives considered**: SQLite FTS5 is acceptable if performance or ranking needs it, but should not be added unless direct SQL matching is insufficient. QMD semantic indexing is explicitly deferred.

## Decision: Duplicate Hints Are Response Data Only

**Decision**: On successful `POST /api/agent/track`, return `possible_duplicates` when recent records strongly overlap the new text. Do not block the insert and do not write duplicate-hint records in Phase 1.

**Rationale**: The hint is advisory and ephemeral. Persisting every hint would create curation state the user did not ask for. The useful Phase 1 behavior is immediate awareness while preserving append-only tracking.

**Alternatives considered**: Auto-setting `supersedes` was rejected because auto-supersession is out of scope. A persisted duplicate-hints table was rejected because there is no Phase 1 requirement to revisit ignored hints.

## Decision: Minimal Surface, Prefer Existing Patterns

**Decision**: Implement the smallest user-facing path that can complete search, open-result, view pending follow-ups, and answer follow-ups. A minimal Surface view using existing API wrapper, inbox/action-row, and focus patterns is preferred if straightforward; documented curl/browser/Signal flows remain acceptable if Surface integration threatens to overbuild Phase 1.

**Rationale**: The development plan explicitly says not to block Phase 1 on polished Surface integration. However, a persistent web UI must meet WCAG 2.2 AA basics if introduced, and existing Surface patterns reduce implementation risk.

**Alternatives considered**: A first-class tracking board or polished tracking view was rejected as Phase 4 scope. A new notification/prompt subsystem was rejected because Lattice already has positive-dismissal and notification posture patterns.

## Decision: Accessibility Evidence Is Conditional On Persistent UI

**Decision**: If Phase 1 changes persistent Surface UI, create `docs/accessibility/tracking-phase1.md` with keyboard, focus, label, and non-color-only state evidence. If only APIs, curl, Signal, or temporary command flows are used, document accessibility evidence as N/A in implementation notes while still checking plain-language output and action labels.

**Rationale**: The spec and preset require WCAG 2.2 AA for persistent web surfaces, but non-web temporary flows do not create durable UI evidence artifacts. CLI and message text still must be readable and not rely on color.

**Alternatives considered**: Creating a full accessibility artifact for API-only work was rejected as noise. Skipping accessibility planning entirely was rejected because retrieval/follow-up flows are user-facing.

## Decision: Bilingual Delivery Not Required

**Decision**: Keep Phase 1 user-facing content in English only.

**Rationale**: Existing Lattice product copy is English-only and no translation resource or bilingual requirement is part of this milestone.

**Alternatives considered**: Introducing bilingual strings now was rejected because it would add translation process work unrelated to the tracking workflow validation.
