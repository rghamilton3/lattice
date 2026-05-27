# Data Model: Tracking Phase 0

## TrackingRecord

Append-only observation of an item, location, displaced state, or tracking-related note.

| Field | Type | Required | Notes |
|-------|------|----------|-------|
| `id` | integer | yes | SQLite primary key |
| `text` | text | yes | Free-form user-recognizable text; trim for validation but preserve submitted content closely enough to recognize |
| `captured_at` | text | yes | ISO 8601 timestamp supplied by the capture path or receiving service |
| `ingested_at` | text | yes | ISO 8601 timestamp set by spine at insert time |
| `source` | text | yes | Capture provenance such as `ha-voice:printing-room`, `tasker-voice`, `signal-text`, `signal-photo` |
| `displaced` | integer boolean | yes | `0` normal/expected-location track, `1` checkout/displaced track |
| `photo_ref` | text nullable | no | Optional photo path/reference when a usable Signal image exists |
| `supersedes` | integer nullable | no | Optional reference to another `tracks.id` |

### Validation Rules

- `text` MUST contain non-whitespace content.
- `source` MUST contain non-whitespace content and identify the capture path.
- `captured_at` MUST contain a valid supplied timestamp or be assigned consistently by the receiving integration before insert.
- `displaced` MUST be an explicit boolean in API input and stored as `0`/`1`.
- `photo_ref` MAY be null and MUST NOT be required for Signal text tracking.
- `supersedes`, when provided, MUST reference an existing track or be rejected consistently.
- Duplicate or stale text is allowed; Phase 0 is append-only.
- Friction notes such as `friction: voice capture missed twice` are ordinary tracking records.

### Relationships

- `TrackingRecord.supersedes` optionally points to another `TrackingRecord`.
- `TrackingQuery.opened_track_id` optionally points to a `TrackingRecord`.

### State Transitions

- Records are created once and not edited or deleted during Phase 0.
- A later record represents correction, movement, check-in, or check-out.
- Current displaced state for an item-like phrase is inferred by newest matching record, not maintained as mutable state.

## TrackingQuery

Search attempt against tracking records, retained so later phases can build loop-closure behavior.

| Field | Type | Required | Notes |
|-------|------|----------|-------|
| `id` | integer | yes | SQLite primary key |
| `query` | text | yes | User-entered search phrase |
| `queried_at` | text | yes | ISO 8601 timestamp set by spine when search is performed |
| `opened_track_id` | integer nullable | no | Track selected/opened by the user |
| `loop_closed_at` | text nullable | no | Reserved for later loop-closure phase |
| `loop_outcome` | text nullable | no | Reserved for later loop-closure phase |

### Validation Rules

- `query` MUST contain non-whitespace content.
- `opened_track_id`, when set, MUST reference an existing track.
- Phase 0 records query/open activity only; it does not surface or process loop-closure prompts.

## CapturePath

Configured entry point that creates tracking records.

| Path | Source Value | Phase 0 Requirement |
|------|--------------|---------------------|
| HA Voice Atom Echo | `ha-voice:<area>` | One printing-room device supports normal and checkout phrases |
| Tasker phone voice | `tasker-voice` | Phone assistant/Tasker supports normal and checkout phrases |
| Signal text | `signal-text` | `/track` and `/checkout` commands route to tracking without breaking `/capture` |
| Signal photo | `signal-photo` | Optional; caption is searchable text and image reference is preserved when available |

## DisplacedState

Boolean attached to each `TrackingRecord`.

- `false`: normal tracking record for expected/current location.
- `true`: checkout/displaced record indicating the item is away from expected place or otherwise checked out.
- The value is selected by command path (`track` vs `checkout`) and is not inferred from text.
