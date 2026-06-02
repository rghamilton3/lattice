# Data Model: Tracking Surface Integration

## TrackingRecord

Append-only observation of an item, location, displaced state, board move, surface entry, or follow-up correction.

| Field | Type | Required | Notes |
|-------|------|----------|-------|
| `id` | integer | yes | Existing SQLite primary key from `tracks` |
| `text` | text | yes | Free-form user-recognizable statement; board moves use `<item phrase> in <bin name>` |
| `captured_at` | text | yes | ISO 8601 timestamp supplied by Surface at action time |
| `ingested_at` | text | yes | ISO 8601 timestamp set by Spine on insert |
| `source` | text | yes | Provenance such as `surface-form`, `surface-drag`, `surface-board`, or `surface-followup` |
| `displaced` | integer boolean | yes | `1` when checked out/away; `0` when placed into a defined location |
| `photo_ref` | text nullable | no | Opaque reference returned by the track photo upload endpoint |
| `supersedes` | integer nullable | no | Prior current record when a move, checkout, or follow-up correction replaces the current answer |

### Validation Rules

- `text`, `source`, and `captured_at` must contain non-whitespace content.
- `captured_at` must parse as a timestamp.
- Surface-created records must use a documented `surface-*` source value.
- `displaced` must be explicit in API input and stored as `0` or `1`.
- `photo_ref`, when supplied, must reference an existing track photo or an existing supported photo reference.
- `supersedes`, when supplied, must reference an existing track.
- Existing records are never edited, deleted, merged, or automatically superseded.

## TrackBin

Durable free-text board bin created manually by the user or lazily promoted from an existing location phrase.

| Field | Type | Required | Notes |
|-------|------|----------|-------|
| `id` | integer | yes | SQLite primary key |
| `name` | text | yes | User-visible free-text bin name |
| `normalized_name` | text | yes | Trimmed/lowercase comparison key for duplicate prevention |
| `created_at` | text | yes | ISO 8601 timestamp |
| `updated_at` | text | yes | ISO 8601 timestamp for rename/archive changes if implemented later |
| `archived_at` | text nullable | no | Optional future-safe soft archive; active bins have null |

### Validation Rules

- `name` must contain non-whitespace content.
- Active `normalized_name` values must be unique.
- Creating a bin from an existing phrase uses the visible phrase as `name`; no taxonomy is required.
- Empty bins remain visible until archived or deleted by an explicit future action.

## TrackPhoto

Local file associated with a tracking record through `tracks.photo_ref`.

| Field | Type | Required | Notes |
|-------|------|----------|-------|
| `ref` | text | yes | Opaque reference used in `tracks.photo_ref` and photo URLs |
| `filename` | text | yes | Original or sanitized display filename |
| `content_type` | text | yes | Accepted image content type |
| `size_bytes` | integer | yes | Used for upload limits and display metadata |
| `stored_path` | text | yes | Local path relative to the track photo storage root |
| `created_at` | text | yes | ISO 8601 timestamp |

### Validation Rules

- Only supported image uploads are accepted for Surface photo upload.
- Photo serving must reject path traversal and symlink escape attempts.
- A missing photo file must not make the text track unusable.

## TrackedItemCard

Derived board representation of a current item phrase. It is not a required persisted table.

| Field | Type | Required | Notes |
|-------|------|----------|-------|
| `item_key` | text | yes | Stable-enough derived key for the current phrase within the response |
| `phrase` | text | yes | User-visible item phrase derived from track text |
| `current_track` | TrackingRecord | yes | Newest useful record for the phrase |
| `bin` | TrackBin nullable | no | Matching active bin, if current location maps to one |
| `location_label` | text | yes | Current location phrase or `Unbinned` |
| `displaced` | boolean | yes | Mirrors current record displaced state |
| `possible_duplicates` | TrackedItemCard[] | no | Advisory near-duplicates for explicit future merge affordance only |

### Validation Rules

- A card appears in exactly one location presentation: matching bin, `Unbinned`, or the chosen displaced presentation.
- Similar item phrases may appear as separate cards.
- Moving a card never merges identities.
- Moving a card creates a new `TrackingRecord`; card placement is then derived from the new record.

## TrackingBoard

Response model for board rendering.

| Field | Type | Required | Notes |
|-------|------|----------|-------|
| `bins` | TrackBin[] | yes | Active manual/lazy bins ordered for display |
| `cards` | TrackedItemCard[] | yes | Current derived item cards |
| `unbinned` | TrackedItemCard[] | yes | Cards with no confident bin/location match |
| `displaced_count` | integer | yes | Count for filter label, not backlog pressure |

## FollowUpPrompt

Existing derived follow-up view from `track_queries`, rendered in Surface.

| Field | Type | Required | Notes |
|-------|------|----------|-------|
| `query_id` | integer | yes | Source `track_queries.id` |
| `query` | text | yes | Original retrieval text |
| `queried_at` | text | yes | Search time |
| `expires_at` | text | yes | Expiration time |
| `opened_track` | TrackingRecord | yes | Track the user opened |
| `affirmative_label` | text | yes | `Still there` or `Still out` |

### State Transitions

```text
pending
  -> still_accurate (close query, no new track)
  -> moved (insert new track with supersedes, close query)
  -> skipped (close query, no new track)
  -> expired (close query, no prompt)
```

## Relationships

- `TrackingRecord.supersedes` points to a prior `TrackingRecord` for moves, checkouts, and follow-up corrections.
- `TrackingRecord.photo_ref` points to a local `TrackPhoto` reference when a photo is attached.
- `TrackedItemCard.current_track` points to the newest useful `TrackingRecord` for a derived phrase.
- `TrackedItemCard.bin` points to a `TrackBin` only when the current location phrase maps to an active bin.
- `FollowUpPrompt.opened_track` points to the `TrackingRecord` opened from a prior search query.
