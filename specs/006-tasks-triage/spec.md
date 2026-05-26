# Feature Specification: Tasks And Triage

**Feature Branch**: `feature/time-machine-tasks-triage`

**Created**: 2026-05-26

**Status**: Draft

**Input**: User description: "Feature: Tasks And Triage. Description: Lets users process captures into keep, archive, promote, task, or skip outcomes and manage active and completed tasks. Relevant files: spine/src/routes/tasks.ts, spine/src/commands.ts, spine/migrations/004_capture_triage.sql, spine/migrations/005_tasks.sql, spine/migrations/006_task_completed_at.sql, spine/tests/unit/commands.test.ts, surface/src/lib/api/tasks.ts, surface/src/lib/state/useCompleteTask.svelte.ts, surface/src/components/process/, surface/src/components/tasks/TasksView.svelte, surface/src/components/overlays/NewTask.svelte. Focus on this feature only; do not modify other features."

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Process Capture Inbox (Priority: P1)

An authenticated user can quickly review untriaged captures and assign one of the supported outcomes: keep, archive, promote, task, or skip. The process flow keeps unreached captures in the inbox and reports failures without losing the user's decisions.

**Why this priority**: Triage is the core workflow that turns a growing inbox into intentional knowledge, work, or deferred items.

**Independent Test**: Seed untriaged captures, run the process flow, choose each outcome at least once, and verify the captures leave or remain in the inbox according to the selected outcome.

**Acceptance Scenarios**:

1. **Given** untriaged captures exist, **When** the user chooses keep, archive, promote, or task, **Then** the capture records the selected outcome and no longer appears in the default inbox list.
2. **Given** an untriaged capture exists, **When** the user chooses skip, **Then** the skipped outcome is recorded and the user can continue processing later without the system deleting the capture.
3. **Given** a process session is stopped or times out, **When** the user exits, **Then** only decisions already made are submitted and any unreached captures remain available.
4. **Given** one or more submitted decisions fail, **When** the session exits, **Then** the user receives a failure count and the inbox refreshes to avoid stale state.

---

### User Story 2 - Create And Manage Active Tasks (Priority: P2)

An authenticated user can create a task directly or from a capture, view active tasks sorted by due date and priority, edit task metadata, and complete a task when finished.

**Why this priority**: Once work is identified, users need a reliable task list that separates active work from capture review.

**Independent Test**: Create tasks with and without metadata, update due date/priority/notes, complete a task, and verify active task ordering and removal from the active list.

**Acceptance Scenarios**:

1. **Given** the user opens the new task dialog, **When** they enter required text and optional due date, priority, and notes, **Then** a task is created and appears in the active task list.
2. **Given** tasks have different due dates and priorities, **When** the active list loads, **Then** tasks with due dates appear first, earlier due dates sort before later due dates, and higher priority breaks same-date ties.
3. **Given** an active task exists, **When** the user edits its metadata, **Then** the active list reflects the new due date, priority, and notes.
4. **Given** an active task exists, **When** the user marks it complete, **Then** it leaves the active list and appears in completed tasks.

---

### User Story 3 - Review And Restore Completed Tasks (Priority: P3)

An authenticated user can reveal completed tasks, see when they were completed, and restore a completed task to active work if needed.

**Why this priority**: Completion history and undo reduce accidental task loss and support review without blocking the primary active-task workflow.

**Independent Test**: Complete a task, expand the completed section, restore the task, and verify it returns to the active list with metadata preserved.

**Acceptance Scenarios**:

1. **Given** completed tasks exist, **When** the user expands the completed section, **Then** completed tasks are shown newest-completed first with a completion time indicator.
2. **Given** a completed task exists, **When** the user restores it, **Then** its completion marker is cleared and it returns to active tasks.

---

### Edge Cases

- Empty, whitespace-only, or excessively long task text must be rejected with a recoverable error.
- Invalid capture ids, task ids, or triage actions must return client-facing errors without mutating data.
- Triage actions submitted for missing captures must report failure without hiding other captures permanently.
- Direct command captures such as `/task`, `/note`, and `/skip` must preserve only the intended body text and must not treat unknown or body-less commands as actions.
- Duplicate task submissions caused by repeated clicks or keyboard activation must not create unintended duplicate rows from a single in-flight submit.
- Completing or restoring a missing or non-task capture must return a not-found error and refresh client state.
- Active task ordering must be deterministic when due dates and priorities are equal.
- Process mode, task lists, dialogs, loading states, error states, and status updates must be keyboard operable and understandable to assistive technology.

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: System MUST allow authenticated users to mark each untriaged capture as keep, archive, promote, task, or skip.
- **FR-002**: System MUST persist the selected triage outcome and triage timestamp for each processed capture.
- **FR-003**: System MUST exclude triaged captures from the default inbox while allowing explicitly requested all-capture views to show triage metadata.
- **FR-004**: System MUST parse supported leading slash commands for capture input and convert them into the corresponding triage outcome while storing only the command body.
- **FR-005**: System MUST treat unknown commands, commands without a body, and slash text not at the start as plain capture text.
- **FR-006**: Users MUST be able to create active tasks with required text plus optional due date, priority, and notes.
- **FR-007**: System MUST list active tasks with due-date-first, priority-aware, deterministic ordering.
- **FR-008**: Users MUST be able to edit due date, priority, and notes for active tasks without changing the original task text.
- **FR-009**: Users MUST be able to complete active tasks and restore completed tasks to active status.
- **FR-010**: System MUST list completed tasks newest-completed first and preserve their task metadata.
- **FR-011**: System MUST provide recoverable validation and not-found errors for invalid ids, invalid actions, invalid task metadata, and missing rows.
- **FR-012**: User-facing triage and task controls MUST meet WCAG 2.2 AA expectations for names, roles, keyboard operation, focus visibility, status/error announcements, and color-not-alone communication.
- **FR-013**: Bilingual delivery is not required for this feature because the current surface ships only English user-facing content; this N/A decision MUST be documented in accessibility evidence.

### Key Entities *(include if feature involves data)*

- **Capture Triage State**: The review outcome for a capture, including capture id, action, and triaged timestamp.
- **Task**: A capture routed to active work, including text, source, captured timestamp, optional due date, priority, notes, and optional completion timestamp.
- **Triage Session**: A short-lived client-side review batch including queue position, timer state, pending decisions, and completion/failure summary.
- **Task Metadata Edit State**: The user-editable due date, priority, and notes values for an active task.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: A user can triage 10 captures with keyboard or pointer controls in under 5 minutes and receive a summary when the session ends.
- **SC-002**: 100% of valid triage decisions persist the chosen action and remove the capture from the default inbox on the next list refresh.
- **SC-003**: A user can create a task with optional metadata in under 30 seconds and see it in the active list without a page refresh.
- **SC-004**: Completing or restoring a task updates active and completed lists within one interaction cycle and never loses the task text or metadata.
- **SC-005**: Automated and documented checks cover task/triage route behavior, command parsing, active/completed task state, and WCAG 2.2 AA evidence for affected UI surfaces.

## Assumptions

- Existing Authentik-protected browser routes remain the authorization boundary for task and triage operations.
- Task records continue to use capture rows with task-specific metadata rather than a separate task table.
- Promote records the promote outcome only; richer working-document creation from promotion remains out of scope unless already implemented elsewhere.
- The process flow intentionally uses small batches and a timer to reduce inbox review load; unreached captures remain available.
- No multilingual UI copy is introduced in this feature phase.
