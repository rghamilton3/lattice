# Contract: Tracking API

## `POST /api/agent/track`

Creates one append-only tracking record.

### Auth

Uses existing `/api/agent/*` bearer-token auth. Requests without the configured agent token are rejected.

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

### Required Fields

- `text`: non-empty string after trimming.
- `captured_at`: non-empty ISO-like timestamp string supplied by the capture path.
- `source`: non-empty capture path string.
- `displaced`: boolean.

### Optional Fields

- `photo_ref`: nullable string reference to an already stored photo.
- `supersedes`: nullable numeric ID of an existing tracking record.

### Response `201` or `200`

```json
{
  "id": 42
}
```

### Error Cases

- Missing/blank `text`: `400` with a clear error.
- Missing/blank `source`: `400`.
- Missing/invalid `displaced`: `400`.
- Missing/blank `captured_at`: `400` unless implementation deliberately assigns receive time before validation.
- Unknown `supersedes`: `400` or `404`, consistently documented by tests.
- Missing/invalid bearer token: existing agent auth error.

## `GET /api/tracks/search?q=<query>`

Searches tracking records and logs the query for later result-open tracking.

### Auth

Uses existing Authentik/browser auth for non-agent `/api/*` routes.

### Query Parameters

- `q`: required non-empty query text.

### Response `200`

```json
{
  "query_id": 7,
  "results": [
    {
      "id": 42,
      "text": "drill is on the garage top shelf, blue case",
      "captured_at": "2026-05-26T14:30:12Z",
      "ingested_at": "2026-05-26T14:30:13Z",
      "source": "ha-voice:printing-room",
      "displaced": false,
      "photo_ref": null,
      "supersedes": null
    }
  ]
}
```

### Ordering

- Exact/simple keyword matches are returned newest first.
- Older matches remain present as history.
- If no exact/simple match exists, implementation may return an empty result set with clear copy or closest available matches if a simple adjacent-match strategy is implemented.

### Error Cases

- Missing/blank `q`: `400`.
- Missing browser auth: existing Authentik auth error.

## `POST /api/tracks/queries/:id/open`

Marks that the user opened a search result.

### Auth

Uses existing Authentik/browser auth for non-agent `/api/*` routes.

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
- Keeps `queried_at` as the search time from query creation.
- Does not create loop-closure prompts in Phase 0.

### Error Cases

- Unknown query ID: `404`.
- Unknown track ID: `404`.
- Missing/invalid `track_id`: `400`.
