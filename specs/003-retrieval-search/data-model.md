# Data Model: Retrieval Search

## Search Result

Represents one item returned from retrieval.

Fields:

- `kind`: `capture`, `local-file`, `working`, `capture-attachment`, or `working-attachment`.
- `id`: Numeric identifier where the underlying item has one. Working docs use slug for opening.
- `score`: Relevance score when returned by search; zero or absent-equivalent for deterministic nearby results.
- `snippet`: Short context displayed in result lists.
- `body`: Full indexed body/context when available.
- `path`: Display path or index path.
- `modified_at`: Timestamp used for recency display when known.
- `machine_id`: Local machine identity for local-file results.
- `slug`: Working document identifier for working results.
- `capture_id`: Owning capture for capture-attachment results.
- `filename`: Attachment filename for attachment results.

Validation:

- Unknown QMD collection roots are ignored.
- Capture and attachment ids must parse as positive integers to become openable results.
- Results with missing backing rows may omit timestamps but must not crash the response.

## Indexed File

Represents a local file known to spine through agent indexing.

Fields:

- `id`: SQLite row id.
- `machine_id`: Identity of the indexing machine.
- `path`: Stored canonical path.
- `hash`: Content hash used for local markdown index filenames.
- `mime_type`: File MIME type.
- `text`: Extracted searchable text.
- `modified_at`: Source file modified timestamp.
- `size_bytes`: Source file size.
- `indexed_at`: Time the index row was written.

Validation:

- `(machine_id, path)` remains unique.
- File list cursors include `modified_at` and `id` and must be valid positive-id cursors.
- Raw file responses require the stored path to resolve exactly to itself.

## Similar Result Set

Represents semantic neighbors for a source item.

Fields:

- `source_kind`: `capture`, `local-file`, or `working`.
- `source_id`: Numeric id for captures/local files or slug for working docs.
- `results`: Up to 10 Search Results.

Validation:

- Source item must exist.
- Result set excludes the source item itself.
- Invalid source kinds are rejected.

## Nearby Result

Represents one item near a requested timestamp.

Fields:

- `id`: Capture or local-file row id.
- `kind`: `capture` or `local-file`.
- `ts`: Timestamp used for the nearby comparison.
- `snippet`: Short text preview.
- `machine_id`: Present for local-file results.

Validation:

- Timestamp is required and must parse as a valid date.
- Time window is clamped to the supported bounds.
- Results are sorted ascending by timestamp.
