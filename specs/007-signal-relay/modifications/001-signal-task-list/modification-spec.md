# Modification: Signal Relay - Task List Command

**Status**: Complete
**Created**: 2026-06-10
**Original Feature**: `specs/007-signal-relay/spec.md`
**Impact Analysis**: `impact-analysis.md`

## Modification Summary

**What We're Changing**: `/task` and `/todo` sent via Signal now return the active task list instead of being ingested as plain captures.

**Why We're Changing It**: The commands are meaningless as captures and collide with the intent of checking what's pending. A user typing `/task` or `/todo` from their phone clearly wants to see their task list, not create a capture titled "/task".

## Current State

**Current Behavior**:
- Any message sent via Signal that doesn't match `/track` or `/checkout` is posted as a capture
- A message like `/task` or `/todo anything` gets stored in the inbox as a capture with that literal text

**Current Limitation**: No way to query the task list from Signal; the commands are wasted as junk captures.

## Proposed Changes

### Functional Changes

**F001: Detect `/task` and `/todo` as query commands**
**Current**: Not recognized; treated as plain capture text
**Proposed**: Messages starting with `/task` or `/todo` (case-insensitive, followed by whitespace or end) trigger `list-tasks` action; follow-on text is ignored
**Breaking**: No
**Rationale**: Consistent with the existing `/track` / `/checkout` command pattern in the parser

**F002: Reply with active task list**
**Current**: N/A
**Proposed**: On `list-tasks` action the relay fetches active tasks from `GET /api/agent/tasks` and sends a formatted text reply via Signal
**Breaking**: No
**Rationale**: Closes the feedback loop for mobile task review

### API Changes

**A001: New agent endpoint `GET /api/agent/tasks`**
**Current Contract**: No agent-authenticated task query endpoint
**Proposed Contract**: Returns active tasks `[{ id, text, task_priority, task_due_date }]` under bearer-token auth
**Breaking**: No - additive
**Rationale**: `/api/tasks` requires Authentik auth; the relay only has agent bearer token access

## Backward Compatibility

Non-breaking additive changes only. Existing `/track`, `/checkout`, and plain-text capture flows are unchanged. The new command intercepts only messages that were previously saved as junk captures.

## Testing

- `signal-messages.test.ts`: 7 new cases covering `/task`, `/todo`, case variants, follow-on text, and non-matching patterns (`/taskname`, `/todos`)
- `signal-relay.test.ts`: `fetchTasks` success/failure cases; `formatTaskList` empty/list/due-date cases
