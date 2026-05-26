# Research: Retrieval Search

## Decision: Use Existing Local QMD Retrieval

**Rationale**: The project already initializes a QMD store from local markdown projections of captures, working docs, local files, and attachment metadata. This matches the constitution's local-first and self-hosting constraints.

**Alternatives considered**: Hosted search service or database-native full-text expansion. Hosted search violates self-hosting; a separate database search path would duplicate QMD behavior and add complexity.

## Decision: Preserve SQLite File Index Shape

**Rationale**: `file_index` already stores machine identity, canonical path, hash, MIME type, text, modified time, size, and indexed time. The agent can upsert into this shape and spine can paginate or serve details from it directly.

**Alternatives considered**: New search-specific file tables. Rejected because the existing schema covers the feature and adding tables would create migration and synchronization work without user value.

## Decision: Bound All User-Controlled Retrieval Responses

**Rationale**: Search result limits, similar result caps, file-list page caps, and nearby time-window bounds keep responses predictable and reduce risk of expensive user-triggered scans.

**Alternatives considered**: Unbounded result streaming. Rejected for this feature because the UI only needs small result sets and pagination already exists for file browsing.

## Decision: Keep Raw File Access Behind Canonical-Path Safety Checks

**Rationale**: File index rows can become stale or point at paths that no longer exist. Raw file serving must only return content if the stored path resolves exactly to itself and must reject symlink-swap and circular symlink cases.

**Alternatives considered**: Serve any path recorded by the index. Rejected because local file paths are sensitive and must fail closed.

## Decision: Similar and Nearby Are Separate Lateral Discovery Paths

**Rationale**: Similar uses semantic retrieval from a source item's text; nearby uses timestamps and deterministic SQLite ordering. Keeping them separate makes tests and user expectations clear.

**Alternatives considered**: One combined lateral endpoint. Rejected because semantic similarity and time adjacency have different inputs, failure modes, and sorting behavior.

## Decision: Record Accessibility Evidence for Search UI

**Rationale**: Search and result browsing are user-facing and must meet WCAG 2.2 AA. Evidence should cover keyboard operation, state text, result action labels, and filter controls.

**Alternatives considered**: Rely on existing component behavior without evidence. Rejected by the feature's A11Y governance expectations.
