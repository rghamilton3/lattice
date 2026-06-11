# Contracts: Signal Task List Command

## New Signal Input Commands

Messages starting with `/task` or `/todo` (case-insensitive) followed by whitespace or end-of-string trigger the task list query. Follow-on text is ignored.

Examples that trigger task list:
- `/task`
- `/TODO`
- `/task show me`
- `/todo anything`

Examples that do NOT trigger task list (treated as captures):
- `/taskname foo` - word continues past "task"
- `/todos` - word continues past "todo"

## New Agent Endpoint

`GET {SPINE_BASE}/api/agent/tasks`

Headers:
- `Authorization: Bearer <LATTICE_AGENT_TOKEN>`
- `X-Forwarded-Proto: https`

Response body:
```json
[
  { "id": 1, "text": "Buy groceries", "task_priority": "high", "task_due_date": null },
  { "id": 2, "text": "Review PR", "task_priority": null, "task_due_date": "2026-06-20" }
]
```

Returns only active tasks (`task_completed_at IS NULL`), ordered by `captured_at DESC`.

## Signal Reply Format

With tasks:
```
Tasks (2):
1. Buy groceries
2. Review PR (due 2026-06-20)
```

No tasks:
```
No active tasks.
```

## Acknowledgements

The existing reaction protocol applies:
- 👀 reaction on parse (same as captures and track commands)
- ✅ reaction on successful task fetch and reply send
- Fetch failures are logged; no ✅ reaction is sent on failure
