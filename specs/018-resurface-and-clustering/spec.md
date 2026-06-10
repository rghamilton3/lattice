---
parent_branch: main
feature_number: "018"
status: In Progress
created_at: 2026-06-09T00:00:00+00:00
---

# Feature Specification: Resurfacing & Clustering

**Feature Branch**: `worktree-feat+resurface-and-clustering`

**Created**: 2026-06-09

**Status**: In Progress

## Overview

Every capture, working doc, and indexed file in Lattice has a vector embedding. Over time, this
corpus develops natural thematic clusters — related captures, docs that talk about the same
concern, notes from the same period or project. The user never sees this structure explicitly,
and relevant older material disappears below the fold.

This feature adds two complementary behaviours:

1. **Clustering** — a background pass groups embedded documents by semantic similarity. The
   result is a set of clusters, each containing captures and/or working docs that share subject
   matter. A cluster can be browsed via the surface.

2. **Resurfacing** — a nightly background pass selects one representative item from each
   meaningful cluster (prioritising material that has gone unvisited the longest) and writes it
   to a `surfaced` log. The home panel surfaces today's picks in a quiet, dismissible list. There
   are no counts, no streaks, no urgency framing.

The experience is: you arrive, see a few things the system thinks might matter right now, open
one or move on. Nothing demands attention.

## User Scenarios and Testing

### User Story 1 - Resurfaced Items on Landing (Priority: P1)

A user opens Lattice and sees a short list of items surfaced from their past — each with a
brief reason ("You haven't looked at this in months", "This is related to what you were
working on"). They can click any item to open it, dismiss individual items, or ignore the whole
panel and get on with their day.

**Why this priority**: This is the entire user-facing value of the feature. Everything else is
infrastructure in service of this moment.

**Independent Test**: With the `resurfacing` feature flag enabled, the home screen shows a
"From your past" panel containing items from the `surfaced` table written by the nightly pass.
Each item shows a snippet and a reason. Clicking one opens the source document. Dismissing one
removes it from the panel and marks it dismissed in the database.

**Acceptance Scenarios**:

1. **Given** the nightly resurfacing pass has run, **When** the user opens the home screen with
   the `resurfacing` flag on, **Then** the panel shows items surfaced today that have not been
   dismissed.
2. **Given** the panel is showing, **When** the user clicks an item, **Then** the source
   document opens in the main pane.
3. **Given** the panel is showing, **When** the user dismisses an item, **Then** it disappears
   from the panel immediately and stays dismissed on future loads.
4. **Given** the user has opened any document, **When** they are viewing it, **Then** the
   resurfaced panel is not visible (the panel is home-only).
5. **Given** the nightly pass ran but produced no non-dismissed items, **When** the user opens
   the home screen, **Then** the panel is absent (not an empty container).

### User Story 2 - Cluster Browse (Priority: P2)

A user is reading a capture and notices it belongs to a cluster — a thematic group of related
material. They open the cluster to see what else is in it and find captures and docs they had
forgotten about.

**Why this priority**: Valuable discovery path but secondary to daily resurfacing.

**Independent Test**: A "show cluster" control on any document with a cluster assignment opens
a panel listing the other members of that cluster. The panel is reachable directly via
`/cluster/:id` for bookmarking or sharing within the session.

**Acceptance Scenarios**:

1. **Given** the `clusters` feature flag is enabled and the clustering pass has run, **When** a
   user is viewing a document with a cluster assignment, **Then** a "show cluster" affordance is
   visible.
2. **Given** the user activates "show cluster", **When** the cluster panel loads, **Then** it
   shows all documents in that cluster with snippets.
3. **Given** the cluster panel is open, **When** the user clicks a cluster member, **Then** the
   source document opens.
4. **Given** a cluster ID that exists, **When** the surface navigates to the cluster view,
   **Then** the panel renders correctly without error.

### User Story 3 - Background Pass Runs Reliably (Priority: P1 — infrastructure)

The nightly resurfacing pass runs without user interaction. A user who never thinks about the
feature still receives surfaced items daily as long as they have content with embeddings.

**Why this priority**: The panel is only useful if it is populated.

**Acceptance Scenarios**:

1. **Given** the spine server starts, **When** 24 hours elapse (or a manual trigger fires),
   **Then** the resurfacing pass runs, writes new entries to `surfaced`, and does not call the
   remote inference endpoint.
2. **Given** the remote inference endpoint is unavailable, **When** the resurfacing pass runs,
   **Then** it completes using only stored embeddings (offline-safe).
3. **Given** the corpus has no embeddings yet, **When** the resurfacing pass runs, **Then** it
   exits gracefully without error and writes nothing.

## Functional Requirements

### F1 — Surfaced table

The `surfaced` table is created exactly as specified:

```sql
CREATE TABLE surfaced (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  target_kind TEXT NOT NULL,
  target_id TEXT NOT NULL,
  surfaced_at TEXT NOT NULL,
  reason TEXT,
  dismissed_at TEXT
);
```

`target_kind` encodes the document type (`capture`, `working`, `local-file`). `target_id`
is the document's natural key for that kind (numeric string for captures, slug for working
docs, path for local files). `dismissed_at` is `NULL` until the user dismisses the item.

### F2 — Clustering pass

A background job reads stored embedding vectors from the QMD database and groups all embedded
documents — captures, working docs, and local-indexed files — by semantic similarity using a
deterministic algorithm (k-means with k ≈ √(corpus size) is the reference implementation,
capped at a practical maximum). The pass runs offline — it uses only vectors already stored;
it never calls the remote inference endpoint.

The clustering result is stored in two tables: one row per cluster (`clusters`) and one row
per cluster member (`cluster_memberships`). Re-running the pass replaces the previous run's
clusters atomically.

### F3 — Nightly resurfacing pass

Once per 24-hour period (with a configurable jitter), the system:

1. Ensures the clustering pass has run; if no clusters exist, runs it first.
2. For each cluster, selects the member using this priority order:
   - **First priority**: items that have never appeared in the `surfaced` table at all.
   - **Tiebreaker**: among equally-prioritised items, pick the oldest by document creation
     date (`ingested_at` for captures, `modified_at` for working docs and local files).
   - **Skip**: items that already have a `surfaced` row with a `surfaced_at` timestamp within
     the past 7 days (whether dismissed or not), to avoid showing the same item repeatedly.
3. Writes one row per selected item to `surfaced` with `surfaced_at = now()` and a short,
   human-readable `reason` string. If no eligible item exists for a cluster (all members
   surfaced within the last 7 days), that cluster is skipped.

The pass must be idempotent: if it runs twice on the same day, the second run does not
duplicate today's entries. It uses only stored data and makes no inference calls.

Surfaced rows are retained indefinitely (no automatic pruning). The table is a permanent log
of what was surfaced and whether it was engaged with.

### F4 — `/api/resurfaced` endpoint

`GET /api/resurfaced` returns today's surfaced items (those with a `surfaced_at` date matching
today's date in the server's local timezone) that have not been dismissed. Each item includes
`id`, `target_kind`, `target_id`, `reason`, and enough metadata to render a snippet
(title/text pulled from the source document).

### F5 — Dismiss endpoint

`POST /api/resurfaced/:id/dismiss` sets `dismissed_at = now()` on the surfaced row. Returns
`{ ok: true }`. The item disappears from subsequent `GET /api/resurfaced` responses.

### F6 — `/api/cluster/:id` endpoint

`GET /api/cluster/:id` returns the cluster's members: an array of objects with `target_kind`,
`target_id`, a title, and a snippet. Returns 404 if the cluster ID does not exist.

### F7 — Cluster membership lookup

`GET /api/cluster/doc/:kind/:target_id` returns the cluster ID for a given document, or
`{ clusterId: null }` when the document has no cluster assignment. Used by the surface to
decide whether to show the "show cluster" affordance.

### F8 — Home panel UI

When the `resurfacing` feature flag is on and today has surfaced items:

- A "From your past" section appears on the home screen inside the existing home grid.
- It is hidden once the user navigates into any document (panel is home-only by design).
- Each item shows a snippet and a reason.
- Each item row has three action buttons: **Useful** (positive dismissal), **Not now**
  (neutral dismissal), **Don't resurface** (permanent mute). All three call the dismiss
  endpoint; the distinction is captured in future iterations via reason metadata if needed.
  For this version, all three trigger the same dismiss action.
- If all items are dismissed or the list is empty after filtering, the section does not render.

### F9 — Cluster view

When the `clusters` feature flag is on, a document viewing any capture, working doc, or
local file shows a "show cluster" affordance. Activating it opens the cluster view in the
**second pane** (splitting the workbench if it is not already split), leaving the source
document visible in the first pane. This matches the existing lateral/similar panel pattern.
The cluster view lists all members with snippets and supports clicking through to any member.

### F10 — Feature flags gate both sides

The `resurfacing` flag gates the home panel (F8). The `clusters` flag gates the cluster
affordance and `/cluster/:id` view (F9). Both flags default to `false` in production.

## Success Criteria

1. A user arriving at the home screen with the `resurfacing` flag enabled, and who has had the
   nightly pass run, sees at least one surfaced item within 2 seconds of page load.

2. Dismissing an item removes it from the panel before the next user interaction (optimistic
   UI or fast API round-trip — the item is gone immediately from the user's perspective).

3. The nightly resurfacing pass completes in under 10 seconds on a corpus of 1000 documents,
   entirely from stored data, with no external network calls.

4. A user following "show cluster" from a document arrives at the cluster view in one
   interaction.

5. After the pass runs for 7 consecutive days, no duplicate `surfaced` rows exist for the
   same `(target_kind, target_id, date)` combination.

6. The resurfacing panel is absent from all views except the home screen.

## Key Entities

### surfaced

| Column | Type | Notes |
|--------|------|-------|
| id | INTEGER PK | Auto-increment |
| target_kind | TEXT | `capture`, `working`, `local-file` |
| target_id | TEXT | Numeric string for captures, slug for working, path for local-files |
| surfaced_at | TEXT | ISO 8601 timestamp |
| reason | TEXT | Human-readable reason phrase |
| dismissed_at | TEXT | NULL until dismissed |

### clusters

| Column | Type | Notes |
|--------|------|-------|
| id | INTEGER PK | Stable within a run; re-run replaces all rows |
| run_at | TEXT | ISO 8601 timestamp of the clustering run |
| label | TEXT | Optional human-readable label (future; NULL for now) |

### cluster_memberships

| Column | Type | Notes |
|--------|------|-------|
| cluster_id | INTEGER FK | References clusters(id), CASCADE DELETE |
| target_kind | TEXT | Same vocabulary as surfaced.target_kind |
| target_id | TEXT | Same vocabulary as surfaced.target_id |

## Assumptions

1. The corpus will typically contain 10–500 embedded documents. The k-means implementation
   is calibrated for this range; the feature makes no claims about larger corpora.

2. Cluster IDs are ephemeral: re-running the clustering pass assigns new IDs. Any surface
   feature relying on a stable cluster ID (e.g., a bookmarked cluster URL) will see a 404
   after the next clustering run. This is acceptable for the MVP; stability is a future
   concern.

3. The three dismissal button labels ("Useful", "Not now", "Don't resurface") are
   functionally identical in this version — all set `dismissed_at`. The distinction is UX
   affordance for future differentiation.

4. "Hidden once inside a doc" means the resurfaced panel lives only on the home screen. No
   changes to doc views are needed to suppress it; the layout already separates home from doc
   panes.

5. All embedded content is eligible for clustering and resurfacing: captures, working docs,
   and local-indexed files. The `local-file` kind uses the file path as `target_id`. Users
   may see filesystem-indexed files in the panel; this is intentional (files they haven't
   opened in a while may be worth revisiting).

6. The `reason` string is generated by the resurfacing pass at write time and is not
   re-computed on read. A short vocabulary of reason phrases is sufficient
   (e.g., "Not visited in a while", "Related to recent work", "From this time last year").

7. Surfaced rows are permanent. The `surfaced` table is treated as an append-only audit log
   of what was surfaced and how the user responded. No automatic cleanup is performed.

## Clarifications

### Session 2026-06-09

- Q: Which content collections should be included in clustering and resurfacing? → A: All embedded content (captures + working docs + local-indexed files).
- Q: What should the resurfacing pass use as a proxy for "went longest without attention"? → A: Never-surfaced items first (by any prior `surfaced` row), then by age (`ingested_at` / `modified_at`). Items surfaced within the past 7 days are skipped.
- Q: Should old surfaced rows be pruned? → A: Keep forever — `surfaced` is a permanent append-only log.
- Q: When "show cluster" is activated from inside a document, where does the cluster view open? → A: Always in the second pane (splitting if needed), so the source document stays visible.
