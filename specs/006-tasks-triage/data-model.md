# Data Model: Tasks And Triage

## Capture Triage State

Represents the outcome assigned to a capture during review.

- `id`: numeric capture id; immutable.
- `triaged_at`: ISO timestamp when an outcome is applied; null while the capture is in the inbox.
- `triage_action`: one of `keep`, `archive`, `promote`, `task`, `skip`; null while untriaged.

Validation:

- Only supported action values are accepted.
- Non-numeric or missing capture ids are rejected.
- Missing capture rows return not-found and do not mutate data.

State transitions:

- `untriaged` -> `triaged` when a supported action is accepted.
- The default inbox includes only `triaged_at IS NULL` rows.

## Task

Represents active or completed work stored as a capture row with `triage_action = task`.

- `id`: numeric capture id; immutable.
- `text`: required task text.
- `source`: capture source, `task` for directly-created tasks.
- `captured_at`: ISO creation timestamp.
- `ingested_at`: ISO ingestion timestamp.
- `triaged_at`: ISO timestamp when the row became a task.
- `triage_action`: fixed as `task` for task lists.
- `task_due_date`: optional date string.
- `task_priority`: optional `high`, `medium`, or `low`.
- `task_notes`: optional notes string.
- `task_completed_at`: optional ISO timestamp; null means active.

Validation:

- Direct task text must be non-empty after trimming.
- Priority must be one of `high`, `medium`, `low`, or null.
- Metadata updates are only valid for rows whose `triage_action` is `task`.
- Completion and restoration are only valid for task rows.

State transitions:

- `active` -> `completed` by setting `task_completed_at`.
- `completed` -> `active` by clearing `task_completed_at`.
- Metadata edits do not change `text`, `source`, or capture timestamps.

## Triage Session

Client-side process-mode state for reviewing a short batch.

- `index`: current queue position.
- `paused`: whether the timer is paused.
- `secondsLeft`: countdown seconds.
- `decisions`: ordered list of `{ id, action }` decisions made in the session.

Validation:

- Only visible queued captures can be advanced.
- Exiting with no decisions performs no network mutations.
- Partial submission failures are reported and followed by a list refresh.

## Task Metadata Edit State

Client-side edit buffer for active task metadata.

- `due_date`: date string or blank.
- `priority`: `high`, `medium`, `low`, or blank.
- `notes`: notes string or blank.
- `saving`: pending state to prevent duplicate writes.

Validation:

- Blank date, priority, or notes clear the corresponding stored metadata.
- Save failures leave the edit panel open and report an error.
