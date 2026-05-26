# Feature Specification: Agent Indexer

**Feature Branch**: `feature/time-machine-agent-indexer`
**Created**: 2026-05-26
**Status**: Draft
**Input**: Feature: Agent Indexer. Description: Polls local watch directories, extracts text from files, deduplicates changes, and posts indexed content to the spine. Relevant files: `agent/src/main.rs`, `agent/src/lib.rs`, `agent/src/scan.rs`, `agent/src/extract.rs`, `agent/src/cache.rs`, `agent/src/config.rs`, `agent/src/time.rs`, `agent/Cargo.toml`, `agent/lattice-agent.service`, `spine/src/routes/agent.ts`, `spine/migrations/007_agent_status.sql`, `spine/tests/routes/agent.test.ts`. Focus on this feature only; do not modify other features.

## User Scenarios & Testing

### User Story 1 - Index Local Watch Directories (Priority: P1)

As a Lattice user running the local agent, I want files in my configured watch directories to appear in Lattice search so that local notes and documents become retrievable without manual upload.

**Why this priority**: Local file indexing is the core value of the agent; without reliable scanning and posting, extraction polish and status reporting do not matter.

**Independent Test**: Configure a temporary watch directory with supported files, run one scan cycle, and verify each changed file is sent to Lattice with path, title, extracted text, source, and modified timestamp.

**Acceptance Scenarios**:

1. **Given** a configured watch directory contains a supported text document, **When** the agent scans, **Then** the document appears as indexed file content in Lattice.
2. **Given** a file changes after a previous scan, **When** the next scan runs, **Then** the updated content replaces the older indexed content.
3. **Given** a watch directory is missing or unreadable, **When** the scan runs, **Then** the agent reports the error and continues scanning other configured directories.

---

### User Story 2 - Avoid Duplicate And Unchanged Posts (Priority: P2)

As a user with large watch folders, I want the agent to skip unchanged files so that indexing remains lightweight and the spine does not receive duplicate data.

**Why this priority**: Deduplication keeps polling safe for daily use and prevents unnecessary write load.

**Independent Test**: Run two scan cycles over unchanged files and verify only the first cycle posts content; then modify one file and verify only that file posts again.

**Acceptance Scenarios**:

1. **Given** a file was already indexed and has not changed, **When** a later scan runs, **Then** the agent skips posting that file.
2. **Given** a file changes content or modified time, **When** the next scan runs, **Then** the agent posts the new version once.
3. **Given** the agent cache is unavailable or corrupt, **When** scanning begins, **Then** the agent rebuilds safe state without crashing or deleting source files.

---

### User Story 3 - Operate As A Local Background Agent (Priority: P3)

As the operator installing Lattice on a machine, I want clear configuration, status reporting, and service behavior so that the agent can run unattended and be diagnosed from the spine.

**Why this priority**: The agent is intended to run continuously on user machines; setup mistakes and offline states must be visible.

**Independent Test**: Start the agent with valid and invalid configuration, verify clear diagnostics and periodic status updates, and review service configuration for restart behavior and required environment/config paths.

**Acceptance Scenarios**:

1. **Given** required spine URL, token, or watch directories are missing, **When** the agent starts, **Then** it exits with clear setup guidance.
2. **Given** the spine is temporarily unavailable, **When** the agent attempts to post content or status, **Then** it reports the failure and retries on the next polling cycle without losing local files.
3. **Given** the agent runs under its service definition, **When** the user logs in or the service restarts, **Then** it loads the same configuration and resumes polling.

### Edge Cases

- Watch directories may be empty, missing, nested, symlinked, unreadable, or contain very large directory trees.
- Files may be deleted, renamed, modified during extraction, unreadable, binary, unsupported, empty, or too large for practical indexing.
- Multiple watch directories may contain the same file through symlinks or overlapping paths.
- Extracted text may be empty, contain invalid encoding, or require truncation to stay within posting limits.
- Cache files may be missing, stale, partially written, or contain entries for files that no longer exist.
- Spine requests may fail with unauthorized, rate-limited, validation, non-JSON, or network errors.
- Agent diagnostics and service output must remain understandable without color or interactive terminal features.

## Requirements

### Functional Requirements

- **FR-001**: The agent MUST load spine connection details, bearer token, poll interval, and watch directories from local configuration or documented environment inputs.
- **FR-002**: The agent MUST validate required configuration before polling and provide clear diagnostics for missing or invalid values.
- **FR-003**: The agent MUST recursively scan configured watch directories while continuing past unreadable or missing directories.
- **FR-004**: The agent MUST extract indexable text and metadata from supported local files and skip unsupported binary or empty content safely.
- **FR-005**: The agent MUST identify files by stable local path plus change metadata sufficient to detect changed content across polling cycles.
- **FR-006**: The agent MUST persist scan cache state so unchanged files are not reposted on later runs.
- **FR-007**: The agent MUST post changed file content to the existing agent ingestion surface using bearer-token authentication.
- **FR-008**: The spine MUST accept agent-indexed file content, persist or update it for retrieval, and reject unauthorized or malformed requests with recoverable errors.
- **FR-009**: The agent MUST report local status including last scan time, indexed/changed/skipped/error counts, and current health state.
- **FR-010**: The spine MUST expose the latest agent status for diagnostics without requiring access to the local machine.
- **FR-011**: The agent service definition MUST run the same binary/configuration unattended and restart after ordinary failures.
- **FR-012**: The feature MUST include automated coverage for configuration validation, scan/deduplication behavior, extraction outcomes, cache handling, and spine agent routes.

### Accessibility & Localization Requirements

- **A11Y-001**: User-facing diagnostics, service output, and setup documentation MUST be plain text, concise, and not rely on color alone.
- **A11Y-002**: Any status content surfaced through existing Lattice UI or docs MUST use clear labels and headings that are keyboard and screen-reader friendly.
- **LANG-001**: Bilingual delivery is not required because this feature adds local agent diagnostics and English-only project documentation, not translated UI copy.

### Key Entities

- **Watch Directory**: A local folder configured for recursive polling and indexing.
- **Indexed File**: A local file represented by path, title/name, extracted text, size, modified time, content fingerprint or change marker, and source machine context.
- **Scan Cache Entry**: Local state indicating what file version was last posted successfully.
- **Agent Status**: Current health and scan summary for a local agent, including last successful scan and recent error counts.

## Success Criteria

### Measurable Outcomes

- **SC-001**: In automated tests, 100% of supported changed files in configured watch directories produce exactly one indexing post per changed version.
- **SC-002**: In automated tests, unchanged files across consecutive scans are skipped without duplicate posts.
- **SC-003**: A local scan of 1,000 small supported files completes without crashing and reports indexed, skipped, and error counts.
- **SC-004**: Configuration failures identify the missing or invalid field before any polling begins.
- **SC-005**: Status reporting shows the latest scan outcome within one polling cycle after success or failure.

## Assumptions

- The agent remains a local, user-controlled process and does not require a hosted indexing service.
- Existing bearer-token agent authentication remains the boundary for file indexing and status routes.
- Initial extraction targets plain text and lightweight local document content already supported or feasible without new hosted dependencies.
- Files remain on the user machine; Lattice stores extracted text and metadata for retrieval rather than copying original files.
- Live OS service behavior may be covered by service file review and targeted command tests rather than full systemd integration in CI.
