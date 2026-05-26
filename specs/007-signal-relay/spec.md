# Feature Specification: Signal Relay

**Feature Branch**: `feature/time-machine-signal-relay`
**Created**: 2026-05-26
**Status**: Draft
**Input**: Feature: Signal Relay. Description: Ingests Signal messages, voice notes, and attachment metadata into Lattice as capture input from the phone path. Relevant files: `spine/src/signal-relay.ts`, `spine/src/signal/messages.ts`, `spine/docker-compose.relay.yml`, `spine/tests/unit/signal-messages.test.ts`, `README.md`.

## User Scenarios & Testing

### User Story 1 - Capture Signal Notes (Priority: P1)

As an authenticated Lattice operator using Signal Note-to-Self, I want messages sent from my phone to appear as captures in Lattice so that mobile thoughts enter the same inbox as desktop captures.

**Why this priority**: The phone capture path is the core value of the relay; without reliable text ingestion, attachments and deployment polish do not matter.

**Independent Test**: Send a valid Note-to-Self text frame, verify exactly one capture payload is posted to Lattice with trimmed text, source `signal`, and the original message timestamp, then verify non-self and malformed frames are skipped without capture posts.

**Acceptance Scenarios**:

1. **Given** a Signal Note-to-Self text message, **When** the relay receives the frame, **Then** it posts a Lattice capture with the message text, Signal source, and original send timestamp.
2. **Given** a Signal frame sent to another recipient or group, **When** the relay receives the frame, **Then** it skips the frame and does not post a capture.
3. **Given** a valid message is accepted by Lattice, **When** the post succeeds, **Then** the relay emits a visible success acknowledgement through Signal where supported.

---

### User Story 2 - Preserve Voice Notes And Attachments (Priority: P2)

As a user capturing from Signal, I want voice notes and files to remain associated with the created capture so that media-only or mixed captures are not lost.

**Why this priority**: Voice notes and quick file sends are common phone capture modes, and missing files make the relay unreliable for mobile use.

**Independent Test**: Receive a Signal frame with audio/file attachments, verify attachment-only messages create meaningful placeholder capture text, verify readable mounted files are uploaded to the capture attachment endpoint with safe metadata, and verify missing or unreadable attachment files are reported without dropping the capture.

**Acceptance Scenarios**:

1. **Given** a voice note with no text, **When** the relay parses it, **Then** it creates a capture with a human-readable voice-note placeholder.
2. **Given** a text message with attachments, **When** the capture is saved, **Then** each readable attachment is uploaded to the corresponding capture record.
3. **Given** an attachment file cannot be read from local Signal storage, **When** the capture has already been saved, **Then** the relay logs the attachment failure and continues running.

---

### User Story 3 - Operate Relay Safely (Priority: P3)

As the operator deploying Lattice, I want the relay to fail fast on missing required configuration, reconnect without runaway socket growth, and document deployment clearly so that the phone path can run unattended on the VPS.

**Why this priority**: The relay is a long-running bridge process. Operational mistakes should be obvious, and transient Signal RPC failures must not destabilize the host.

**Independent Test**: Start the relay with missing required environment variables and verify clear startup failure; simulate connection failures and verify only one reconnect timer/socket path is active; review README and compose configuration for required environment variables, host-network assumptions, and attachment mount instructions.

**Acceptance Scenarios**:

1. **Given** required secrets or phone configuration are missing, **When** the relay starts, **Then** it exits with a clear diagnostic before connecting.
2. **Given** Signal RPC disconnects or refuses connections, **When** the relay handles failures, **Then** reconnect attempts are bounded to a single backoff path.
3. **Given** an operator follows the documented Docker Compose instructions, **When** required variables and mounts are provided, **Then** the relay can reach Signal RPC and the local Lattice spine endpoint.

### Edge Cases

- Signal JSON-RPC frames may arrive split across TCP chunks or multiple frames may arrive in one chunk.
- Signal frames may be JSON-RPC errors, malformed JSON, unknown methods, missing envelopes, missing payloads, non-self sends, or group sends.
- Messages may contain only whitespace, only attachments, text plus attachments, unknown attachment MIME types, missing filenames, or missing attachment ids.
- Attachment ids and filenames may contain unsafe path characters and must not allow reads outside the configured attachment directory.
- Attachment files may be missing, unreadable, too large for practical upload, or report a size different from bytes read.
- Lattice capture or attachment endpoints may reject requests, return non-JSON errors, or be temporarily unavailable.
- Signal reaction/reply writes may fail due to closed sockets or backpressure and must not crash ingestion.
- Reconnect callbacks may fire from multiple failure paths for the same outage.

## Requirements

### Functional Requirements

- **FR-001**: The relay MUST require an agent bearer token and Signal phone number before attempting to connect to Signal RPC.
- **FR-002**: The relay MUST accept only Signal Note-to-Self messages for the configured phone number and MUST skip non-self, group, malformed, empty, and unsupported frames.
- **FR-003**: The relay MUST preserve the original Signal message timestamp as the Lattice capture timestamp when Signal provides one, with a current-time fallback only when no timestamp exists.
- **FR-004**: The relay MUST trim message text for capture content while preserving attachment-only captures through readable placeholder text.
- **FR-005**: The relay MUST post accepted captures to the existing agent capture endpoint with source `signal` and bearer-token authentication.
- **FR-006**: The relay MUST upload each readable Signal attachment to the created capture using the existing agent attachment endpoint, including Signal id, MIME type, filename, byte size, and file bytes.
- **FR-007**: The relay MUST confine attachment file reads to the configured Signal attachment directory and reject unsafe ids or resolved paths outside that directory.
- **FR-008**: The relay MUST keep a saved capture even when one or more attachment uploads fail, and MUST log enough context to diagnose the failed attachment.
- **FR-009**: The relay MUST send best-effort Signal acknowledgements for parsed and saved messages without allowing acknowledgement failures to interrupt capture ingestion.
- **FR-010**: The relay MUST maintain a single active socket or reconnect timer and apply capped exponential backoff after failures.
- **FR-011**: The relay documentation MUST identify required environment variables, Signal RPC host assumptions, local spine URL expectations, attachment mount configuration, and text-only behavior when attachments are not configured.
- **FR-012**: The feature MUST include automated coverage for parsing, skip reasons, placeholder text, attachment path safety, and reconnect/operational helper behavior where testable without a live Signal service.

### Accessibility & Localization Requirements

- **A11Y-001**: User-facing documentation for setup and diagnostics MUST use clear headings, code fences, and concise labels so it is navigable with assistive technology.
- **A11Y-002**: CLI/log output introduced or changed by this feature MUST remain plain text, concise, and not rely on color alone.
- **LANG-001**: Bilingual delivery is not required for this feature because the relay has no translated user interface and existing project documentation is English-only.

### Key Entities

- **Signal Frame**: A JSON-RPC receive event from Signal RPC containing envelope data, optional text, optional attachments, and timestamps.
- **Relay Capture**: A normalized capture payload sent to Lattice with text, source, and captured timestamp.
- **Signal Attachment**: Metadata and local file bytes associated with a Signal frame and uploaded to a saved Lattice capture.
- **Relay Connection State**: Runtime state for active socket, connection attempt, reconnect timer, and backoff.

## Success Criteria

### Measurable Outcomes

- **SC-001**: 100% of valid Note-to-Self text frames in automated tests produce exactly one normalized capture payload.
- **SC-002**: 100% of unsupported or non-self frames in automated tests are skipped without capture posts and expose a distinct skip reason where debug hooks are enabled.
- **SC-003**: Attachment-only frames in automated tests produce human-readable capture text rather than empty captures.
- **SC-004**: Path-safety tests demonstrate that unsafe attachment ids cannot read files outside the configured attachment directory.
- **SC-005**: Reconnect behavior tests or documented code review evidence show that concurrent failure paths collapse into one reconnect schedule.

## Assumptions

- The relay is an optional operator-run bridge process and does not change the browser Authentik model.
- Signal RPC is reachable from the relay process using host networking or equivalent local networking.
- Lattice spine remains the source of truth; Signal data is copied into captures and capture attachments.
- Live end-to-end Signal testing may be documented manually because CI does not run signal-cli.
