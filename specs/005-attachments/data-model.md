# Data Model: Attachments

## Capture Attachment

Represents a file associated with a capture.

Fields:
- `id`: Stable numeric attachment identifier.
- `capture_id`: Parent capture identifier; must refer to an existing capture for upload/list/read/delete operations.
- `signal_id`: Stable Signal-origin identifier when uploaded by the agent; empty for browser uploads.
- `filename`: Original display filename provided by the upload source.
- `content_type`: Media type supplied by the upload source, defaulting to a safe binary type when absent.
- `size_bytes`: Decoded file size in bytes; must match actual stored byte length.
- `stored_path`: Relative storage path under the attachment directory.
- `upload_source`: Origin label such as `browser` or `signal`.
- `created_at`: ISO timestamp for chronological listing and retrieval metadata.

Validation rules:
- Capture id must be numeric and must exist.
- Raw attachment reads and deletes must match both attachment id and capture id.
- Stored paths must resolve under the configured attachment directory before raw serving.
- Download filenames must be sanitized for response headers without changing stored metadata.

State transitions:
- Uploaded: metadata row exists, binary exists, metadata index file exists.
- Missing Binary: metadata row exists but binary is absent; raw serving returns not found.
- Deleted: metadata row removed, binary cleanup attempted, metadata index removed, retrieval refreshed.

## Working Attachment

Represents a file associated with a working document.

Fields:
- `id`: Stable numeric attachment identifier.
- `slug`: Parent working document slug.
- `filename`: Original display filename.
- `content_type`: Media type supplied by upload source, defaulting to a safe binary type when absent.
- `size_bytes`: Stored byte length.
- `stored_path`: Relative storage path under `working/<slug>/` in the attachment directory.
- `created_at`: ISO timestamp for chronological listing and retrieval metadata.

Validation rules:
- Slug must match the working document slug format and must resolve to an existing working document.
- Raw reads and deletes must match both attachment id and slug.
- Stored paths must resolve under the canonical working attachment directory before raw serving.

State transitions:
- Uploaded: metadata row exists, binary exists, working metadata index file exists.
- Missing Binary: metadata row exists but binary is absent; raw serving returns not found.
- Deleted: metadata row removed, binary cleanup attempted, metadata index removed, retrieval refreshed.

## Attachment Preview State

Represents what the user sees when opening an attachment.

States:
- `idle`: No attachment selected.
- `loading`: Preview or raw file is being fetched.
- `ready`: File content or browser download is available.
- `failed`: Preview failed or raw file returned an error.
- `unavailable`: Attachment metadata exists but binary cannot be opened.

Validation rules:
- Loading and failure states must be perceivable without color alone.
- Errors must not strand keyboard users inside a preview region.

## Attachment Retrieval Entry

Represents searchable metadata for a capture or working attachment.

Fields:
- `id`: Attachment identifier.
- `kind`: `capture-attachment` or `working-attachment`.
- `parent`: Capture id or working slug.
- `filename`: Filename text used for retrieval.
- `content_type`: Media type metadata.
- `size_bytes`: Size metadata.
- `created_at`: Timestamp used as modified time in results.

Validation rules:
- Upload must create or refresh a retrieval metadata entry.
- Delete must remove the retrieval metadata entry and refresh retrieval.
- Stale QMD hits should not expose attachments that no longer have a backing metadata row.
