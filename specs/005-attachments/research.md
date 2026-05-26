# Research: Attachments

## Local Binary Storage with SQLite Metadata

**Decision**: Keep attachment binaries under the configured spine attachment directory and store metadata in SQLite tables keyed by parent item.

**Rationale**: This matches the local-first constitution, avoids mandatory object storage, and keeps backups/deployment simple for a single-user self-hosted system.

**Alternatives considered**: External object storage was rejected because it violates self-hosting-first defaults. Storing binaries in SQLite was rejected because current route and agent flows already use filesystem paths and because large blobs would make the primary database harder to inspect and back up incrementally.

## Separate Capture and Working Attachment Records

**Decision**: Preserve separate capture attachment and working attachment schemas, with capture rows supporting `upload_source` and working rows keyed by document slug.

**Rationale**: Captures can receive browser and Signal-origin attachments, while working documents are user-authored markdown records. Separate records keep route validation simple and avoid a polymorphic table migration with no current benefit.

**Alternatives considered**: A unified attachment table was rejected as a speculative abstraction and migration churn without three concrete parent types.

## Metadata-Only Retrieval Entries

**Decision**: Index attachment metadata as markdown files containing id, parent identity, filename, content type, size, and creation time.

**Rationale**: This makes attachment identity and filenames findable through the existing QMD pipeline without adding OCR, antivirus, or binary text extraction dependencies.

**Alternatives considered**: Full binary extraction was rejected as out of scope and dependency-heavy. Skipping retrieval indexing was rejected because the feature explicitly requires attachment metadata in retrieval.

## Safe Raw File Serving

**Decision**: Continue to serve raw attachments only after resolving stored paths and confirming the canonical file path remains under the configured attachment directory.

**Rationale**: Attachment filenames and stored paths are user-influenced or agent-influenced data; canonical-path checks protect against traversal, symlink swaps, and stale database rows pointing outside storage.

**Alternatives considered**: Trusting stored paths was rejected on security grounds. Copying files through a separate sandbox service was rejected as unnecessary infrastructure.

## Surface Upload, Rail, and Preview Accessibility

**Decision**: Keep the existing upload dialog, reading-pane attach action, attachment rail, and PDF viewer, but tighten labels/status/error/focus behavior where tests or review find gaps. Record WCAG 2.2 AA evidence.

**Rationale**: The current UI components already match the workbench model. Incremental accessibility improvements minimize churn while satisfying the governance preset.

**Alternatives considered**: Replacing the rail or adding a separate attachment page was rejected because it would duplicate navigation patterns and broaden scope.
