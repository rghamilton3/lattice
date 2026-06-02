# Contract: Tracking Surface API

All `/api/tracks/*` routes use the existing browser/AuthentiK auth model. `/api/agent/track` remains bearer-token authenticated and is not called by Surface.

## `POST /api/tracks`

Creates one append-only browser-originated tracking record.

### Request

```json
{
  "text": "drill is on the garage top shelf, blue case",
  "captured_at": "2026-06-02T14:30:12Z",
  "source": "surface-form",
  "displaced": false,
  "photo_ref": "track-photo:2026/06/abc123",
  "supersedes": null
}
```

### Response `201`

```json
{
  "id": 88,
  "possible_duplicates": []
}
```

### Behavior

- Reuses the existing append-only track validation and duplicate-hint behavior.
- Accepts only documented `surface-*` source values from browser flows.
- Does not edit, merge, delete, or automatically supersede older records.

## `POST /api/tracks/photos`

Uploads one optional browser photo for later association with a tracking record.

### Request

Multipart form body with field `file` containing an image.

### Response `201`

```json
{
  "ref": "track-photo:2026/06/abc123",
  "filename": "drawer.jpg",
  "content_type": "image/jpeg",
  "size_bytes": 482391,
  "url": "/api/tracks/photos/track-photo%3A2026%2F06%2Fabc123/raw"
}
```

### Behavior

- Stores the file under user-controlled local storage.
- Returns an opaque `ref` suitable for `tracks.photo_ref`.
- Rejects unsupported or missing uploads with a clear error.
- Does not create a track by itself.

## `GET /api/tracks/photos/:ref/raw`

Serves an authenticated tracking photo.

### Behavior

- Resolves only known track photo references.
- Uses canonical-path checks equivalent to existing attachment serving.
- Returns `404` for missing DB/file references and `403` for unsafe paths.
- Sends `X-Content-Type-Options: nosniff`.

## `GET /api/tracks/search?q=<query>`

Existing Phase 1 search route used by Surface.

### Required Response Fields

```json
{
  "query_id": 7,
  "primary": {
    "id": 42,
    "text": "drill is on the garage top shelf, blue case",
    "captured_at": "2026-05-26T14:30:12Z",
    "ingested_at": "2026-05-26T14:30:13Z",
    "source": "surface-form",
    "displaced": false,
    "photo_ref": null,
    "supersedes": null
  },
  "history": [],
  "empty_message": null,
  "results": []
}
```

### Phase 4 Requirements

- Surface must visually distinguish `primary` from `history`.
- Results must expose time, source, displaced state, and photo availability.
- Blank query returns `400`.

## `GET /api/tracks/:id`

Returns a stable tracking reading view payload.

### Response `200`

```json
{
  "record": {
    "id": 42,
    "text": "drill is on the garage top shelf, blue case",
    "captured_at": "2026-05-26T14:30:12Z",
    "ingested_at": "2026-05-26T14:30:13Z",
    "source": "surface-form",
    "displaced": false,
    "photo_ref": null,
    "supersedes": null
  },
  "same_item_history": [],
  "related_location_tracks": []
}
```

### Behavior

- `record` is the exact selected row.
- `same_item_history` contains other records that appear to mention the same item phrase.
- `related_location_tracks` contains records that appear related to the current location context.
- Unknown IDs return `404`.

## `GET /api/tracks/board?displaced=all|only`

Returns the derived tracking board.

### Response `200`

```json
{
  "bins": [
    {
      "id": 1,
      "name": "Garage shelf",
      "normalized_name": "garage shelf",
      "created_at": "2026-06-02T10:00:00Z",
      "updated_at": "2026-06-02T10:00:00Z"
    }
  ],
  "cards": [
    {
      "item_key": "drill",
      "item_phrase": "drill",
      "current_track": {
        "id": 42,
        "text": "drill in Garage shelf",
        "captured_at": "2026-06-02T10:15:00Z",
        "ingested_at": "2026-06-02T10:15:01Z",
        "source": "surface-drag",
        "displaced": false,
        "photo_ref": null,
        "supersedes": 17
      },
      "bin_id": 1,
      "location_label": "Garage shelf",
      "displaced": false,
      "possible_duplicates": []
    }
  ],
  "unbinned": [],
  "displaced_count": 0
}
```

### Behavior

- Derives cards from current track history.
- Includes each current item phrase in exactly one location presentation.
- Does not merge fuzzy duplicates.
- `displaced=only` filters cards to displaced current records.

## `POST /api/tracks/bins`

Creates a manual or phrase-promoted bin.

### Request

```json
{
  "name": "Garage shelf"
}
```

### Response `201`

```json
{
  "bin": {
    "id": 1,
    "name": "Garage shelf",
    "normalized_name": "garage shelf",
    "created_at": "2026-06-02T10:00:00Z",
    "updated_at": "2026-06-02T10:00:00Z",
    "archived_at": null
  }
}
```

### Error Cases

- Blank name: `400`.
- Duplicate active normalized name: `409` with the existing bin payload or clear error.

## `POST /api/tracks/board/move`

Moves a card to a bin by creating a new append-only track.

### Request

```json
{
  "item_key": "drill",
  "item_phrase": "drill",
  "from_track_id": 42,
  "to_bin_id": 1,
  "captured_at": "2026-06-02T10:15:00Z",
  "source": "surface-drag"
}
```

### Response `201`

```json
{
  "track_id": 89,
  "text": "drill in Garage shelf",
  "displaced": false,
  "supersedes": 42
}
```

### Behavior

- Inserts a new `tracks` row with `displaced = false`.
- Sets `supersedes` to `from_track_id`.
- Does not mutate the old track or persist a separate card position.
- Keyboard move controls may use `source: "surface-board"`; pointer drag may use `source: "surface-drag"`.

## `POST /api/tracks/board/checkout`

Marks a card displaced by creating a new append-only track.

### Request

```json
{
  "item_key": "drill",
  "item_phrase": "drill",
  "from_track_id": 42,
  "context": "working on the deck for the weekend",
  "captured_at": "2026-06-02T10:20:00Z",
  "source": "surface-board"
}
```

### Response `201`

```json
{
  "track_id": 90,
  "text": "drill checked out: working on the deck for the weekend",
  "displaced": true,
  "supersedes": 42
}
```

## Existing Follow-Up Routes

Surface uses the existing Phase 1 routes without changing outcomes:

- `GET /api/tracks/followups`
- `POST /api/tracks/followups/:query_id/still-accurate`
- `POST /api/tracks/followups/:query_id/moved`
- `POST /api/tracks/followups/:query_id/skip`

The moved route uses `source: "surface-followup"` from Surface.
