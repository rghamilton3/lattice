# Contract: Tracking Workflow API

All routes use existing Lattice auth boundaries: `/api/agent/*` requires bearer-token auth and `/api/tracks/*` requires browser/AuthentiK auth.

## `POST /api/agent/track`

Creates one append-only tracking record and may return advisory duplicate hints.

### Request

```json
{
  "text": "drill is on the garage top shelf, blue case",
  "captured_at": "2026-05-26T14:30:12Z",
  "source": "ha-voice:printing-room",
  "displaced": false,
  "photo_ref": null,
  "supersedes": null
}
```

### Response `201`

```json
{
  "id": 42,
  "possible_duplicates": [
    {
      "track_id": 17,
      "text": "drill in blue case on garage shelf",
      "captured_at": "2026-05-20T09:12:00Z",
      "source": "signal-text",
      "displaced": false,
      "reason": "shared phrase: garage shelf"
    }
  ]
}
```

### Behavior

- Inserts the new record before or independently from duplicate-hint calculation.
- Checks recent records, approximately the past 90 days, for strong phrase overlap.
- Returns an empty `possible_duplicates` array when no strong overlap is found.
- Does not edit, merge, delete, or automatically supersede any existing record.

### Error Cases

- Missing/blank `text`: `400` with clear error.
- Missing/blank `source`: `400`.
- Missing/invalid `captured_at`: `400`.
- Missing/invalid `displaced`: `400`.
- Unknown `supersedes`: `404` or existing documented error behavior.
- Missing/invalid bearer token: existing agent auth error.

## `GET /api/tracks/search?q=<query>`

Searches tracking records, logs the query, and returns a primary answer plus history.

### Response `200`

```json
{
  "query_id": 7,
  "primary": {
    "id": 42,
    "text": "drill is on the garage top shelf, blue case",
    "captured_at": "2026-05-26T14:30:12Z",
    "ingested_at": "2026-05-26T14:30:13Z",
    "source": "ha-voice:printing-room",
    "displaced": false,
    "photo_ref": null,
    "supersedes": null
  },
  "history": [
    {
      "id": 17,
      "text": "drill on workbench",
      "captured_at": "2026-04-01T10:00:00Z",
      "ingested_at": "2026-04-01T10:00:01Z",
      "source": "tasker-voice",
      "displaced": false,
      "photo_ref": null,
      "supersedes": null
    }
  ],
  "empty_message": null
}
```

### Compatibility Note

Existing Phase 0 clients may receive or use a flat `results` array during implementation, but Phase 1 user-facing behavior must distinguish the primary newest answer from older history.

### Behavior

- Trims and validates query text.
- Logs a `track_queries` row for every valid search.
- Ranks records by lightweight keyword/phrase match and recency.
- Shows record text, time, source, displaced state, photo reference, and supersedes reference.
- Provides a clear empty state or closest simple matches when no exact/simple match exists.

### Error Cases

- Missing/blank `q`: `400`.
- Missing browser auth: existing Authentik auth error.

## `POST /api/tracks/queries/:id/open`

Marks that the user opened a specific search result.

### Request

```json
{
  "track_id": 42
}
```

### Response `200`

```json
{
  "ok": true
}
```

### Behavior

- Sets `track_queries.opened_track_id` to the supplied track ID.
- Leaves `queried_at` as the original search time.
- Makes the query eligible for derived follow-up after the minimum elapsed time if all trigger conditions still pass.

### Error Cases

- Unknown query ID: `404`.
- Unknown track ID: `404`.
- Missing/invalid `track_id`: `400`.

## `GET /api/tracks/followups`

Returns currently pending loop-closure follow-ups derived from opened search queries.

### Response `200`

```json
{
  "followups": [
    {
      "query_id": 7,
      "query": "where is the drill",
      "queried_at": "2026-05-24T14:30:12Z",
      "expires_at": "2026-06-07T14:30:12Z",
      "opened_track": {
        "id": 42,
        "text": "drill is on the garage top shelf, blue case",
        "captured_at": "2026-05-20T14:30:12Z",
        "ingested_at": "2026-05-20T14:30:13Z",
        "source": "ha-voice:printing-room",
        "displaced": false,
        "photo_ref": null,
        "supersedes": null
      },
      "affirmative_label": "Still there"
    }
  ]
}
```

### Behavior

- Includes only opened, unclosed queries that meet timing rules.
- Excludes queries with newer matching tracks after the original query.
- Expires old unanswered queries by closing them with `loop_outcome = "expired"` and omitting them from the response.
- Does not expose counts, badges, overdue labels, or backlog wording.

## `POST /api/tracks/followups/:query_id/still-accurate`

Closes a pending follow-up as still accurate.

### Response `200`

```json
{
  "ok": true,
  "outcome": "still_accurate"
}
```

### Behavior

- Sets `loop_outcome = "still_accurate"` and `loop_closed_at = now`.
- Creates no tracking record.

## `POST /api/tracks/followups/:query_id/moved`

Creates a new append-only tracking record and closes the follow-up as moved.

### Request

```json
{
  "text": "drill is in the basement charging",
  "captured_at": "2026-05-27T08:15:00Z",
  "source": "surface-followup",
  "displaced": false,
  "photo_ref": null
}
```

### Response `201`

```json
{
  "ok": true,
  "outcome": "moved",
  "track_id": 55
}
```

### Behavior

- Validates non-blank replacement text.
- Inserts a new `tracks` row with `supersedes` set to the opened track ID where supported.
- Sets `loop_outcome = "moved"` and `loop_closed_at = now` on the query.
- Does not mutate the opened track.

## `POST /api/tracks/followups/:query_id/skip`

Closes a pending follow-up as skipped.

### Response `200`

```json
{
  "ok": true,
  "outcome": "skipped"
}
```

### Behavior

- Sets `loop_outcome = "skipped"` and `loop_closed_at = now`.
- Creates no tracking record.
- Does not reschedule the prompt or create debt.

## Shared Follow-Up Error Cases

- Unknown query ID: `404`.
- Query was never opened: `409` or `404`, consistently documented by tests.
- Follow-up already closed or expired: `409`.
- Follow-up suppressed by newer matching track: `409` or omitted from pending list.
- Blank moved text: `400`.
- Missing browser auth: existing Authentik auth error.
