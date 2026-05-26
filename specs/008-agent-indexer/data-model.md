# Data Model: Agent Indexer

## Watch Directory

- **Purpose**: Defines a local root folder and glob patterns to poll.
- **Fields**: `path`, `patterns`.
- **Validation**: Path must be non-empty after `~` expansion. Invalid glob patterns are ignored with diagnostics rather than aborting the whole scan.
- **Lifecycle**: New watch paths force a full scan once, then are recorded as known paths in the local cache.

## Indexed File

- **Purpose**: Represents extracted local file content stored by spine for retrieval.
- **Fields**: `machine_id`, `path`, `hash`, `mime_type`, `text`, `modified_at`, `size_bytes`, `indexed_at`.
- **Identity**: The spine row is unique by `machine_id + path`; a changed hash updates the existing row in place.
- **Validation**: Machine id, path, hash, MIME type, and modified timestamp are required. Size must be non-negative. Text may be empty only if the extractor produced empty supported content.
- **Lifecycle**: Created or updated by `/api/agent/index`; old QMD markdown for the previous hash is removed when a file changes.

## Scan Cache Entry

- **Purpose**: Tracks what local file version was successfully posted.
- **Fields**: `path`, `mtime_secs`, `size_bytes`, `hash`, `last_sent_at`.
- **Identity**: Local path is the primary key.
- **Lifecycle**: Upserted only after successful spine indexing, or after same-hash metadata drift is confirmed.

## Known Watch Path

- **Purpose**: Records watch roots already seen by the agent.
- **Fields**: `path`, `first_seen_at`.
- **Identity**: Watch root path is the primary key.
- **Lifecycle**: Inserted after a scan pass for the watch path; cleared by forced reindex.

## Agent Status

- **Purpose**: Exposes latest local agent health to spine diagnostics.
- **Fields**: `machine_id`, `state`, `last_scan_at`, `last_indexed`, `last_skipped`, `last_errors`, `spine_ok`, `last_error_msg`, `reported_at`.
- **Identity**: Machine id is the primary key.
- **States**: `idle`, `scanning`, `error`.
- **Lifecycle**: Upserted on scan completion and periodic heartbeat; stale rows remain visible but are counted inactive by reported time.
