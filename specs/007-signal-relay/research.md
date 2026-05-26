# Research: Signal Relay

## Decision: Accept Only Note-to-Self Frames

**Rationale**: The relay is a personal phone capture path. Restricting ingestion to frames from the configured Signal number and destined to the same number prevents accidental capture of normal conversations or group messages.

**Alternatives Considered**: Group or contact allowlists were rejected as broader scope and higher privacy risk.

## Decision: Keep Signal RPC As Operator-Run Local Dependency

**Rationale**: Signal ingestion requires signal-cli or equivalent local bridge, but Lattice should not own or host a third-party Signal service. The relay remains optional and reaches Signal RPC through loopback/host networking.

**Alternatives Considered**: Embedding a Signal client in spine was rejected due to complexity, account safety, and dependency expansion.

## Decision: Save Capture Before Uploading Attachments

**Rationale**: Captures are the durable user-facing record. Saving the capture first means attachment read/upload failures do not lose the text or placeholder context.

**Alternatives Considered**: All-or-nothing capture plus attachment ingestion was rejected because missing local files would drop otherwise valid phone notes.

## Decision: Path-Confine Attachment Reads

**Rationale**: Signal attachment ids originate outside Lattice. Canonical path checks prevent traversal or symlink escapes from reading arbitrary host files.

**Alternatives Considered**: String prefix checks alone were rejected because they are fragile around symlinks and relative path segments.

## Decision: Test Pure Helpers Instead Of Live Signal RPC

**Rationale**: CI does not run signal-cli. Parser and relay helper behavior can still be covered with unit tests for normalization, skip reasons, path safety, and request payload formation.

**Alternatives Considered**: Dockerized live signal-cli tests were rejected as brittle and outside this feature's scope.

## Decision: Treat Accessibility Scope As Documentation And Logs

**Rationale**: The relay has no graphical UI. User-facing artifacts are README instructions, compose comments, and terminal diagnostics.

**Alternatives Considered**: A separate relay admin UI was rejected as out of scope.
