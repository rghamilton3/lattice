# Data Model: Desktop Companions

## Quick Capture

**Purpose**: A user-entered text item destined for the spine capture inbox.

**Fields**: text, source, captured_at, delivery result.

**Identity**: The spine assigns final capture identity after successful delivery. Local attempts are transient unless queued.

**Validation**: Text must contain non-whitespace content. Source and timestamp must be present for delivered payloads.

**Lifecycle**: Entered → posted successfully, queued for retry, or surfaced as unrecoverably failed.

## Queued Capture

**Purpose**: Durable local fallback for captures that could not be sent immediately.

**Fields**: local id, text, source, captured_at, queued_at.

**Identity**: Local autoincrement id until delivery; removed after successful POST or permanent rejection.

**Validation**: Text/source/timestamps must be readable before retry. Corrupt rows are diagnostic events and should be removed or skipped safely.

**Lifecycle**: Created on retryable failure → drained in local id order → deleted on success or permanent client rejection.

## Desktop Agent Status

**Purpose**: Local status snapshot for tray/config companions.

**Fields**: state, last_scan_at, last_indexed, last_skipped, last_errors, spine_ok, last_error_msg.

**Identity**: One current status snapshot from the running local agent.

**Validation**: Unknown future state values must not crash clients; they should render as an understandable unknown/error state.

**Lifecycle**: Agent starts with idle defaults → scan/status updates change the snapshot → companions fetch on demand.

## Agent Configuration

**Purpose**: Local TOML settings for spine connection and indexing behavior.

**Fields**: spine URL, agent token, optional machine id, poll interval, max file bytes, watch directory rows with patterns.

**Identity**: One config file per user profile/platform config directory.

**Validation**: Required connection values must be non-empty before usable saves; watch rows may be empty but must not create invalid TOML.

**Lifecycle**: Created by installer or user → loaded by editor/agent → edited and atomically saved → applied after restart or reindex.

## Companion Service

**Purpose**: Platform startup/control definition for agent/tray companions.

**Fields**: service or task name, executable path, restart/startup policy, user scope.

**Identity**: Linux systemd user unit or Windows scheduled task name.

**Validation**: Paths must point to installed binaries; failures should produce plain text diagnostics.

**Lifecycle**: Installed/updated by installer → started at login or manually → controlled by tray/menu or platform commands.
