# Quickstart: Tasks And Triage

## Automated Validation

From `spine/`:

```sh
bun test tests/unit/commands.test.ts tests/routes/captures.test.ts tests/routes/tasks.test.ts
```

From `surface/`:

```sh
bun run check
```

## Manual Validation

1. Start the app and create several inbox captures.
2. Open process mode from the home inbox.
3. Use keyboard shortcuts and buttons for keep, archive, promote, task, and skip.
4. Exit the session and confirm the summary toast appears; verify unreached captures remain in the inbox.
5. Create a new task with text, due date, priority, and notes.
6. Open the Tasks view; confirm due-date and priority ordering.
7. Edit a task's metadata; confirm success feedback and updated chips/notes.
8. Complete a task; expand completed tasks; restore it and confirm it returns active.
9. Submit invalid routes or stale ids through tests/dev tools and confirm recoverable errors.

## Accessibility Evidence Checklist

- Process mode buttons and shortcuts are keyboard operable and have accessible names.
- Timer/progress and final summaries are perceivable without relying on color alone.
- Loading and error states in process mode, home task preview, task view, and new-task dialog use status or alert semantics where appropriate.
- The new-task dialog traps focus, supports Escape to close, and labels all input fields.
- Active/completed task controls expose clear button labels for complete, restore, edit, save, and cancel.
- Bilingual delivery is documented as N/A for this feature phase.
