# Feature Specification: Spine Platform

**Feature Branch**: `001-spine-platform`

**Created**: 2026-05-25

**Status**: Draft

**Input**: User description: "Feature: Spine Platform. Description: Provides the authenticated, self-hosted server foundation, database migrations, configuration, static serving, and health/status surfaces for Lattice. Relevant files: spine/src/app.ts, spine/src/index.ts, spine/src/config.ts, spine/src/db.ts, spine/src/guards.ts, spine/src/routes/status.ts, spine/migrations/, spine/Dockerfile, spine/docker-compose.yml, Justfile. Focus on this feature only; do not modify other features."

## Clarifications

### Session 2026-05-25

- Q: What should count as a ready Spine Platform status? -> A: Core platform ready: configuration is valid, storage is initialized/upgraded, access boundary is enforceable, and static assets are available if configured.

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Start A Self-Hosted Lattice Spine (Priority: P1)

As a self-hosting user, I want the Lattice spine to start from a clear local configuration, prepare its required storage, and expose the application surface so I can run my knowledge system on my own machine or server.

**Why this priority**: Without a reliable spine foundation, capture, retrieval, working documents, and the surface cannot operate.

**Independent Test**: Can be fully tested by starting the spine from a clean local environment and confirming the service becomes available with initialized storage and application assets.

**Acceptance Scenarios**:

1. **Given** a clean host with valid configuration, **When** the user starts the spine, **Then** the service initializes required storage and reports itself ready.
2. **Given** the spine is running, **When** the user opens the application entry point, **Then** the user receives the static application surface rather than a server error.
3. **Given** the spine has already initialized storage, **When** it restarts, **Then** existing local data remains available and initialization does not duplicate or corrupt prior state.

---

### User Story 2 - Enforce Protected Access (Priority: P2)

As a self-hosting user, I want private spine routes to require the expected access boundary so my personal knowledge data is not exposed accidentally.

**Why this priority**: The spine stores and serves personal knowledge data, so the platform foundation must fail closed when access requirements are not satisfied.

**Independent Test**: Can be tested by attempting protected and public interactions with missing, invalid, and valid credentials and confirming only authorized access succeeds.

**Acceptance Scenarios**:

1. **Given** an unauthenticated request to a protected route, **When** the spine evaluates the request, **Then** access is denied without disclosing private data.
2. **Given** a request with valid access, **When** the spine evaluates the request, **Then** the intended platform capability is available.
3. **Given** required security configuration is missing or invalid, **When** the spine starts or handles protected access, **Then** it fails safely and communicates the configuration problem to the operator.

---

### User Story 3 - Monitor Platform Health (Priority: P3)

As an operator of my personal Lattice instance, I want a clear status surface so I can tell whether the spine is healthy and ready before relying on it.

**Why this priority**: Operational visibility reduces time spent diagnosing local deployment, configuration, and storage issues.

**Independent Test**: Can be tested by checking the status surface under healthy and intentionally misconfigured conditions and verifying it reports readiness accurately.

**Acceptance Scenarios**:

1. **Given** the spine is healthy, **When** the operator checks status, **Then** the response indicates the service is ready.
2. **Given** a required dependency is unavailable or misconfigured, **When** the operator checks status, **Then** the response clearly indicates the service is not ready.
3. **Given** the operator uses deployment helpers, **When** they request the documented platform commands, **Then** they can start, stop, and inspect the spine consistently.

### Edge Cases

- The storage location is missing, read-only, or contains a partially initialized schema.
- Required configuration values are missing, malformed, or conflict with safe defaults.
- The service restarts while initialization is in progress.
- Static application assets are missing or unavailable.
- A health/status request arrives before initialization has completed.
- A protected request includes malformed or expired credentials.

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: The system MUST provide a single spine startup path that validates configuration before exposing protected capabilities.
- **FR-002**: The system MUST initialize and upgrade local storage to the schema required by the platform foundation without losing existing user data.
- **FR-003**: The system MUST preserve local-first operation by keeping platform-owned data under operator-controlled storage.
- **FR-004**: The system MUST expose the application surface from the spine when static assets are available.
- **FR-005**: The system MUST expose a status surface that distinguishes ready, starting, and unhealthy platform states, where ready means configuration is valid, storage is initialized or upgraded, the access boundary is enforceable, and configured static assets are available.
- **FR-006**: The system MUST deny protected access when required authentication or authorization evidence is absent or invalid.
- **FR-007**: The system MUST fail closed when security-critical configuration is absent, invalid, or ambiguous.
- **FR-008**: The system MUST provide operator-facing deployment commands or packaging metadata sufficient to start, stop, and inspect the spine.
- **FR-009**: The system MUST report configuration, startup, and storage errors in language that helps an operator correct the problem without exposing private data.
- **FR-010**: The system MUST keep platform responsibilities bounded to foundation concerns and avoid taking ownership of capture, search, document editing, attachment, task, relay, agent, or surface workbench behavior except where needed to host or protect them.

### Key Entities *(include if feature involves data)*

- **Platform Configuration**: Operator-controlled settings that determine storage location, service exposure, security expectations, and static asset availability.
- **Platform Storage State**: The local persistence state required for the spine foundation, including schema version and readiness.
- **Access Boundary**: The rules and evidence used to decide whether a request may reach protected personal knowledge capabilities.
- **Platform Status**: The externally visible readiness and health information an operator uses to evaluate the spine.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: A user can start the spine from a clean local setup and reach a ready status in under 2 minutes on supported hardware.
- **SC-002**: Restarting an already initialized spine preserves existing platform data in 100% of normal restart attempts.
- **SC-003**: 100% of protected requests without valid access are denied without returning private knowledge content.
- **SC-004**: Operators can identify whether the spine is core-platform ready or unhealthy in under 10 seconds using the status surface.
- **SC-005**: At least 95% of startup or configuration failures provide an actionable operator-facing message.

## Assumptions

- Target users are self-hosting operators who control the machine or server where Lattice runs.
- The platform foundation may host user-facing application assets, but this feature does not design or change the application workbench experience.
- Existing capture, search, working document, attachment, task, relay, and agent capabilities are outside this feature except for being hosted, protected, or initialized by the platform foundation.
- Accessibility governance: no new interactive user interface is introduced by this feature; WCAG 2.2 AA applies to any user-visible static error/status text, while `docs/accessibility/` evidence is not updated because the feature is platform infrastructure with no new UI workflow.
- Bilingual delivery is not required because no multilingual user-facing content requirement has been identified for this platform foundation.
