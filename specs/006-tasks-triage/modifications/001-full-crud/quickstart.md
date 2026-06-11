# Quickstart: 006-mod-001 Full CRUD for Tasks

## Prerequisites

```bash
just dev    # spine + surface running at localhost:3000 / localhost:5173
```

## Verify the gap (current behavior)

Open the Tasks view. Expand any task. Notice there is no Delete button and the text is read-only.

## Implement

See `tasks.md` for the ordered task list. The critical path is:

```
T001 (search.ts export)
  → T002 (DELETE route)
  → T003 (PATCH text extension)
  → T006, T007 (surface API client)
  → T008-T014 (TasksView.svelte)
```

T004, T005 (spine tests) and the surface API client changes (T006, T007) can run in parallel with each other after their respective spine route changes are done.

## Validate

```bash
just test     # spine tests
just check    # tsc
just lint     # oxlint + eslint
```

Manual smoke test: create a task, expand it, edit text, save, delete with confirm.
