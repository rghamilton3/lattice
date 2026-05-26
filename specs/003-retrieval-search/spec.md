# Feature Specification: Retrieval Search

**Feature Branch**: `feature/time-machine-retrieval-search`

**Created**: 2026-05-26

**Status**: Draft

**Input**: User description: "Feature: Retrieval Search. Description: Indexes captures and local files for semantic search, file browsing, lateral movement, and related-document discovery. Relevant files: spine/src/search.ts, spine/src/routes/search.ts, spine/src/routes/lateral.ts, spine/src/routes/files.ts, spine/migrations/002_file_index.sql, spine/tests/routes/search.test.ts, spine/tests/routes/lateral.test.ts, spine/tests/routes/files.test.ts, surface/src/lib/api/search.ts, surface/src/lib/api/files.ts, surface/src/components/search/. Focus on this feature only; do not modify other features."

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Search Indexed Knowledge (Priority: P1)

Users can enter a query and receive relevant results from their captures, working material, and indexed local files, with each result showing enough context to decide whether to open it.

**Why this priority**: Search is the primary retrieval path for Lattice; without it, captures and indexed files cannot be rediscovered reliably.

**Independent Test**: Seed captures and indexed files, perform a query, and verify results include source kind, snippet/context, recency information, and openable identifiers.

**Acceptance Scenarios**:

1. **Given** indexed captures and local files exist, **When** the user searches for matching terms, **Then** the user sees relevant results grouped as searchable items with snippets and source labels.
2. **Given** a blank or whitespace-only query, **When** the user submits search, **Then** the system rejects it with clear feedback and does not perform a search.
3. **Given** search indexing is temporarily unavailable, **When** the user searches, **Then** the system remains usable and communicates that no searchable results are currently available.

---

### User Story 2 - Browse Indexed Files (Priority: P2)

Users can browse recently indexed local files and open file details or raw file content from the spine when the file is still available and safe to serve.

**Why this priority**: File browsing complements semantic search and gives users a deterministic path into the local file index.

**Independent Test**: Seed file index rows, browse the file list, paginate results, open a file detail, and request raw content for a valid canonical file path.

**Acceptance Scenarios**:

1. **Given** multiple indexed files, **When** the user opens the file browser, **Then** files appear newest-first with stable pagination and no duplicates.
2. **Given** a file index row points to a missing file, **When** the user opens raw content, **Then** the user receives a clear not-found response.
3. **Given** a stored file path resolves through a symlink or unsafe canonical path, **When** raw content is requested, **Then** access is denied.

---

### User Story 3 - Discover Related Material (Priority: P3)

Users can move laterally from a capture, working document, or local file to similar or temporally nearby material without manually crafting a new search query.

**Why this priority**: Lateral discovery turns search results into exploration and helps users find related context around a thought or file.

**Independent Test**: Seed a source item and other candidate items, request similar and nearby results, and verify the source item is excluded while related or time-adjacent items are returned.

**Acceptance Scenarios**:

1. **Given** a source capture exists, **When** the user requests similar items, **Then** related results are shown and the source capture is not repeated.
2. **Given** a timestamp and time window, **When** the user requests nearby items, **Then** captures and local files within that window are returned in chronological order.
3. **Given** an invalid source id, source kind, timestamp, or cursor, **When** the user requests lateral or nearby material, **Then** the system rejects the request with clear error feedback.

---

### Edge Cases

- Search queries that are empty or whitespace-only are rejected before retrieval.
- Malformed, empty, or non-positive pagination cursors are rejected.
- File listing limits are capped to prevent excessive responses.
- Missing source captures, working documents, or local files return not-found responses.
- Missing files on disk return not-found responses for raw content.
- Stored file paths that resolve to a different canonical path or circular symlink are denied.
- Similar results exclude the source item itself.
- Nearby time windows are bounded to prevent unreasonable scans.

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: System MUST accept non-empty user search queries and return relevant results from indexed captures, working material, local files, and indexed attachment metadata where available.
- **FR-002**: System MUST reject missing, empty, or whitespace-only search queries with clear error feedback.
- **FR-003**: Search results MUST include a source kind, snippet, display path or equivalent title, relevance score when available, and an openable reference.
- **FR-004**: System MUST maintain a searchable local index for captures, working material, local files, and indexed attachment metadata using local-first storage.
- **FR-005**: System MUST remain usable when search indexing is unavailable by returning a safe empty state or clear error instead of crashing the user-facing service.
- **FR-006**: Users MUST be able to browse indexed local files newest-first with stable pagination.
- **FR-007**: System MUST reject malformed file-list cursors and cap file-list page sizes.
- **FR-008**: Users MUST be able to open file details for indexed files and request raw file content when the stored file is present and safe to serve.
- **FR-009**: System MUST deny raw file access when the stored path does not match its canonical path or cannot be safely resolved.
- **FR-010**: Users MUST be able to request similar items for captures, working documents, and local files.
- **FR-011**: Similar-item results MUST exclude the source item itself and limit result count to a usable set.
- **FR-012**: Users MUST be able to request nearby captures and local files around a timestamp within a bounded time window.
- **FR-013**: Search, file browsing, similar, and nearby APIs MUST remain protected by the existing authenticated user boundary.
- **FR-014**: Search and result browsing UI MUST meet WCAG 2.2 AA for keyboard navigation, visible state text, accessible controls, and readable result summaries.
- **FR-015**: Bilingual delivery is not required for this feature.

### Key Entities *(include if feature involves data)*

- **Search Result**: A retrievable item with kind, snippet, body/context, display path/title, optional score, modified time, and fields needed to open the underlying capture, working document, file, or attachment owner.
- **Indexed File**: A local file index entry with machine identity, canonical path, hash, MIME type, text content, modified time, size, and indexed time.
- **Similar Result Set**: A bounded list of search results related to a source item, excluding the source item.
- **Nearby Result**: A capture or indexed file within a requested time window, returned with timestamp, snippet, kind, and machine identity where relevant.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: Users can find at least one seeded matching capture or local file from a search query in one search attempt.
- **SC-002**: Empty or whitespace-only search submissions are rejected 100% of the time without changing the visible result list.
- **SC-003**: File browsing returns newest-first pages with no duplicate items across consecutive pages for seeded data.
- **SC-004**: Unsafe raw file paths are denied 100% of the time in validation scenarios.
- **SC-005**: Similar-item requests return no more than 10 results and never include the requested source item.
- **SC-006**: Nearby-item requests return only items inside the bounded window and preserve chronological ordering.
- **SC-007**: Search and result browsing controls can be operated with keyboard input and expose clear loading, empty, and error text.

## Assumptions

- Existing Authentik-protected `/api/*` behavior applies to search, files, similar, and nearby endpoints.
- Existing local-first storage and indexer-agent ingestion remain the source of file index rows.
- Search may use the existing local retrieval engine; no external hosted search service is required.
- Attachment search remains limited to indexed metadata unless another feature later expands attachment content extraction.
- Saved searches and clustering facets are out of scope unless already present and only need preservation.
