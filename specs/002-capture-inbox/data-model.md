# Data Model: Capture Inbox

## Capture

Represents a plain-text item saved into the user's inbox for later review.

### Fields

- `id`: Unique numeric identity assigned by spine.
- `text`: Plain text capture body, trimmed for meaningful content and limited to 10,000 characters.
- `source`: Origin label for the capture, such as browser quick capture or desktop hotkey.
- `captured_at`: Time the capture was created from the user's perspective. Browser quick captures use server-generated time.
- `ingested_at`: Time spine persisted the capture.
- `triaged_at`: Nullable time a later workflow removed the item from the inbox.
- `triage_action`: Nullable later workflow outcome; this feature treats null as inbox-visible.

### Validation Rules

- `text` must contain at least one non-whitespace character after trimming.
- `text` must not exceed 10,000 characters.
- `source` must contain at least one non-whitespace character.
- Browser-created captures must be associated with an authenticated user request.

### State Transitions

- Created: a valid request persists the capture with `triaged_at = null` and `triage_action = null` unless a later command parser explicitly pre-triages it.
- Inbox visible: captures with `triaged_at = null` appear in the default recent inbox list.
- Removed from inbox: later triage functionality sets `triaged_at` and `triage_action`; default inbox listing excludes it.

## Inbox

Represents the newest untriaged captures visible to the user.

### Rules

- Ordered by `ingested_at` descending, with `id` as a stable tie-breaker.
- Default recent view returns at least 50 captures.
- Empty inbox is a valid state and must be represented without error.

## Live Capture Update

Represents a process-local notification emitted after a capture is persisted.

### Fields

- Full capture payload matching the capture list item shape.

### Rules

- Emitted only after successful persistence.
- Duplicate event handling in the UI must not duplicate visible rows.
- Interrupted live updates must not remove existing inbox data.
