# Research: Tasks And Triage

## Decision: Keep tasks as capture rows

**Rationale**: Existing migrations already add task and triage columns to `captures`, capture text/source/timestamps are sufficient task provenance, and using one table keeps inbox-to-task routing atomic.

**Alternatives considered**: A separate `tasks` table was rejected because it would require synchronization with capture rows and add indirection without current multi-user or recurrence needs.

## Decision: Keep slash-command parsing strict and leading-only

**Rationale**: `/task`, `/note`, and `/skip` are shortcuts for capture entry. Treating unknown or body-less commands as plain text prevents accidental data loss and avoids surprising users who write slash-prefixed content.

**Alternatives considered**: A larger command grammar was rejected because promote/archive command shortcuts and arguments are not needed for the current workflow.

## Decision: Sort active tasks by due date, priority, then recency/id

**Rationale**: Due tasks need to surface before undated work, priority resolves same-date urgency, and a deterministic tie-break prevents visual jumpiness between refreshes.

**Alternatives considered**: Database-only ordering was considered but in-process sort already exists and is sufficient for the current local-first scale.

## Decision: Submit process-mode decisions when exiting the session

**Rationale**: Local session state enables fast card advancement and preserves the "stop anytime" experience. Exit submission can summarize partial failures and refresh the inbox.

**Alternatives considered**: Per-card immediate mutation was rejected because it slows the flow and complicates undo/error feedback for the batch.

## Decision: Document WCAG 2.2 AA evidence for process/task UI

**Rationale**: The feature changes keyboard shortcuts, dialogs, expandable sections, status/error copy, and optimistic completion, all of which need explicit names, roles, focus, and announcements evidence.

**Alternatives considered**: Relying on generic surface accessibility evidence was rejected because the process mode has custom global keyboard behavior.
