# Data Model: Tracking Phase 1

## TrackingRecord

Append-only observation of an item, location, displaced state, update, or friction note. Phase 1 keeps the Phase 0 shape and adds response-time duplicate hints around new inserts.

| Field | Type | Required | Notes |
|-------|------|----------|-------|
| `id` | integer | yes | SQLite primary key |
| `text` | text | yes | Free-form user-recognizable text; no category/tag/item/location parsing |
| `captured_at` | text | yes | ISO 8601 timestamp supplied by capture path or receiving service |
| `ingested_at` | text | yes | ISO 8601 timestamp set by spine at insert time |
| `source` | text | yes | Capture provenance such as `ha-voice:printing-room`, `tasker-voice`, `signal-text`, or `manual-smoke` |
| `displaced` | integer boolean | yes | `0` normal/current location, `1` checked out/displaced |
| `photo_ref` | text nullable | no | Optional photo path/reference; no OCR in Phase 1 |
| `supersedes` | integer nullable | no | Optional reference to another `tracks.id` when the user records an update from a follow-up |

### Validation Rules

- `text`, `source`, and `captured_at` MUST contain non-whitespace content.
- `captured_at` MUST parse as a timestamp or be rejected consistently.
- `displaced` MUST be an explicit boolean in API input and stored as `0`/`1`.
- `supersedes`, when provided, MUST reference an existing track.
- New records MUST be inserted even when duplicate hints are found.
- Existing records MUST NOT be edited, deleted, merged, or automatically superseded.
- Friction notes such as `friction: loop prompt showed up while busy` remain ordinary records.

### Relationships

- `TrackingRecord.supersedes` optionally points to a prior `TrackingRecord`.
- `TrackingQuery.opened_track_id` points to the `TrackingRecord` the user opened.
- `DuplicateHint.candidate_track_id` points to recent prior `TrackingRecord` rows but is not persisted in Phase 1.

### State Transitions

- Records are created once and remain immutable.
- Moves, corrections, check-ins, and checkouts create new records.
- Current displaced state for a phrase is inferred from the newest useful matching record.

## TrackingQuery

Search attempt against tracking records and persistent lifecycle state for loop closure.

| Field | Type | Required | Notes |
|-------|------|----------|-------|
| `id` | integer | yes | SQLite primary key |
| `query` | text | yes | User-entered search phrase after trimming |
| `queried_at` | text | yes | ISO 8601 timestamp set by spine when search is performed |
| `opened_track_id` | integer nullable | no | Track selected/opened by the user; null means no follow-up eligibility |
| `loop_closed_at` | text nullable | no | Set when the follow-up is answered or expired |
| `loop_outcome` | text nullable | no | `still_accurate`, `moved`, `skipped`, or `expired` |

### Validation Rules

- `query` MUST contain non-whitespace content.
- `opened_track_id`, when set, MUST reference an existing track.
- A query with no opened result MUST NOT create or show a follow-up.
- `loop_outcome` MUST be one of the four known outcomes when non-null.
- A closed query MUST NOT be offered as a pending follow-up again.

### State Transitions

```text
created/search logged
  -> opened (opened_track_id set)
  -> pending follow-up (derived after threshold, if not suppressed/expired)
  -> still_accurate (loop_outcome set, loop_closed_at set)
  -> moved (new TrackingRecord inserted with supersedes, loop_outcome set, loop_closed_at set)
  -> skipped (loop_outcome set, loop_closed_at set)
  -> expired (loop_outcome set, loop_closed_at set by expiration processing)
```

## LoopClosureFollowUp

Derived view of an eligible `TrackingQuery`, not a separate required table in Phase 1.

| Field | Type | Required | Notes |
|-------|------|----------|-------|
| `query_id` | integer | yes | Source `track_queries.id` |
| `query` | text | yes | Original retrieval text |
| `queried_at` | text | yes | Search time used for age/expiration copy |
| `opened_track` | TrackingRecord | yes | Opened result quoted in the prompt |
| `affirmative_label` | text | yes | `Still there` for non-displaced, `Still out` for displaced |
| `expires_at` | text | yes | Query time plus follow-up window |

### Eligibility Rules

- Query was created within the recent follow-up window.
- `opened_track_id` is set and references an existing track.
- At least the configured minimum elapsed time has passed since `queried_at`.
- `loop_closed_at` is null.
- No newer matching track after `queried_at` makes the follow-up obsolete.
- Query has not expired.

## DuplicateHint

Advisory, response-only signal returned when a new track strongly overlaps a recent prior record.

| Field | Type | Required | Notes |
|-------|------|----------|-------|
| `track_id` | integer | yes | Existing candidate track ID |
| `text` | text | yes | Candidate track text for user recognition |
| `captured_at` | text | yes | Candidate track timestamp |
| `source` | text | yes | Candidate provenance |
| `displaced` | boolean | yes | Candidate displaced state |
| `reason` | text | yes | Short plain-language explanation such as `shared phrase: garage shelf` |

### Validation Rules

- Duplicate hints MUST be advisory only.
- Duplicate hints MUST NOT block saving the new record.
- Duplicate hints MUST NOT mutate old records or set `supersedes` without an explicit user action.
- Missing or uncertain hints are acceptable; false certainty is not required for Phase 1.

## RetrievalResult

User-facing search result grouping.

| Field | Type | Required | Notes |
|-------|------|----------|-------|
| `query_id` | integer | yes | Tracking query row used for result-open logging |
| `primary` | TrackingRecord nullable | no | Newest useful/highest-ranked match, if any |
| `history` | TrackingRecord[] | yes | Older matching rows or all matching rows when no primary can be identified separately |
| `empty_message` | text nullable | no | Clear explanation when no useful match exists |

### Validation Rules

- Blank query text MUST be rejected with a clear user-facing failure.
- Search MUST expose enough context to act: text, time, source/provenance, and displaced state.
- Older matching records MUST remain available as history.
- Empty or weak matches MUST avoid a dead-end where feasible by showing closest simple matches or clear next-step text.
