# Research: Agent Indexer

## Polling Strategy

**Decision**: Use interval polling over configured watch directories instead of filesystem notification.

**Rationale**: Polling is simpler, reliable across local filesystems and sync folders, and matches the requirement that changes become discoverable within a polling cycle rather than instantly. It avoids platform-specific watcher edge cases and service permissions.

**Alternatives considered**: Native filesystem notifications were rejected for v1 because cross-platform behavior and missed-event recovery would add complexity before the single-machine path is proven.

## Change Detection And Dedupe

**Decision**: Cache path, modified time, size, and BLAKE3 hash locally; skip unchanged `(mtime, size)` without rereading, and skip same-hash files after metadata drift.

**Rationale**: This minimizes disk reads and network posts while still detecting actual content changes. The spine route remains idempotent on `machine_id + path` with hash-based update behavior.

**Alternatives considered**: Hashing every file on every scan was rejected as unnecessarily expensive. Trusting only modified time was rejected because timestamp drift can create false positives and missed content changes on some filesystems.

## Local Cache Storage

**Decision**: Use a local SQLite cache under the platform data directory.

**Rationale**: SQLite is already in the approved local stack through `rusqlite`, is durable across restarts, and supports simple upserts without inventing a custom cache format.

**Alternatives considered**: JSON cache files were rejected because partial writes and concurrent service access are harder to make safe. In-memory cache was rejected because restarts would repost all files.

## Text Extraction

**Decision**: Read `text/*` files directly, extract PDFs through local `pdftotext`, and skip unsupported types with diagnostics.

**Rationale**: This covers the highest-value local notes and PDFs without a hosted service or heavyweight dependency. Failing PDF extraction should affect only that file.

**Alternatives considered**: Adding broad document parsing libraries was rejected for v1 scope. Uploading original files to spine for extraction was rejected because the agent should keep originals local.

## Spine Indexing Boundary

**Decision**: Agent posts extracted text/metadata to spine; spine persists file rows, writes QMD-readable markdown, and refreshes the index.

**Rationale**: The constitution assigns embedding/search ownership to spine. Keeping the agent as extractor/poster avoids local vector storage and keeps retrieval behavior centralized.

**Alternatives considered**: Local embeddings were rejected because they create cross-machine index consistency and dependency problems. Direct agent writes to spine storage were rejected because they break component boundaries.

## Accessibility And Localization

**Decision**: Treat terminal/service diagnostics and docs as user-facing artifacts; keep output plain text, concise, and color-independent. Bilingual delivery is N/A for this phase.

**Rationale**: The feature primarily exposes CLI/service output and setup docs. English-only diagnostics match the existing project language and no translated UI copy is introduced.

**Alternatives considered**: Full localized diagnostic catalogs were rejected as out of scope until the product has a multilingual surface requirement.
