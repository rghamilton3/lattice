# Data Model: Web Archival And Inbox Evolution

## Archive

Represents a durable saved web page artifact and its searchable technical metadata.

### Fields

- `id`: Unique numeric identity assigned by spine.
- `url`: Original or canonical URL submitted/captured for the page.
- `title`: Optional user-facing page title; URL fallback is used when absent.
- `archived_at`: ISO timestamp when spine accepted or completed the archive.
- `captured_via`: Technical capture path, such as `singlefile` or `monolith`.
- `hash`: Content hash of the stored archive file.
- `archive_path`: Local spine-controlled path for the stored HTML artifact.
- `extracted_text`: Plain text extracted from the archived artifact for search and review.
- `source`: Optional context label such as `browser-ext`, `mobile-share`, `hotkey`, or `scripted`.
- `why_saved`: Optional one-line user note captured at save time.
- `quality`: Technical quality: `good`, `degraded`, or `failed`.
- `supersedes`: Nullable archive id for the older archive this row supersedes.
- `reviewed_at`: Nullable timestamp when optional recent review or recapture review was resolved.
- `review_action`: Nullable outcome such as `keep`, `archive`, `recapture`, `delete`, `skip`, or `auto-kept`.

### Validation Rules

- `url` must be a non-empty HTTP or HTTPS URL.
- `captured_via` must be a known capture method for routing and diagnostics.
- `hash` must be non-empty and match the stored file bytes.
- `archive_path` must resolve under the configured archive storage directory.
- `quality` must be one of `good`, `degraded`, or `failed`.
- `why_saved` is optional but must be trimmed and bounded to a short single-line note when present.
- `supersedes`, when set, must reference an existing archive and must not create cycles.

### State Transitions

- URL requested: a URL-only request creates a pending in-memory job; no archive row is visible until bytes or a classified failure result exists.
- Good archive: a successful rendered capture or clean URL-only capture stores bytes, writes metadata, creates search index text, and enters optional recent review.
- Degraded archive: a technically incomplete URL-only capture stores best-effort bytes/text, does not appear in default good search, and enters recapture review.
- Failed archive: a recoverable failed attempt records enough metadata for recapture review and may have no useful artifact text.
- Superseded: a newer good rendered capture for the same URL marks older degraded/failed current rows as superseded; old bytes remain unless explicitly deleted.
- Deleted: user delete removes the archive from active review/search and removes or tombstones local artifacts according to implementation safety rules.

## Archive Job

Represents in-process work created by URL-only archive requests.

### Fields

- `id`: Process-local job identifier.
- `url`: Submitted URL.
- `source`: Optional source context.
- `why_saved`: Optional save reason.
- `created_at`: ISO timestamp when the request was accepted.
- `started_at`: Nullable timestamp when the worker starts.
- `finished_at`: Nullable timestamp when classification completes.
- `status`: `queued`, `running`, `stored`, or `failed`.
- `archive_id`: Nullable stored archive id after completion.
- `error`: Nullable technical failure message for diagnostics.

### Rules

- Jobs are best-effort and process-local in v1.
- Worker concurrency is one unless later evidence requires more.
- A job timing out creates a failed or degraded archive review item when enough URL metadata exists.

## Quality Classification

Represents the technical assessment of URL-only archive output.

### Inputs

- Artifact exists and has non-zero bytes.
- Extracted text length and token-like content.
- HTML body shape and ratio of meaningful text to markup.
- Known browser-rendering-required phrases.
- Mostly empty app shell markers such as a single root element with little content.
- Monolith exit status, timeout, and stderr summary.

### Outcomes

- `good`: Artifact and extracted text appear technically usable.
- `degraded`: Artifact exists but signals suggest incomplete capture.
- `failed`: No usable artifact was produced, or execution failed before useful bytes were stored.

## Inbox Item

Represents one row in the surface inbox across multiple item categories.

### Fields

- `item_type`: `capture`, `archive_recapture`, or `archive_recent`.
- `id`: Stable item identifier scoped by type.
- `title`: User-facing label.
- `summary`: Short body or extracted-text preview.
- `source`: Source label.
- `url`: Optional archive URL for web items.
- `created_at`: Time used for sorting and relative display.
- `actions`: Ordered action descriptors for the item type.
- `quality`: Archive quality for web items.
- `archive_id`: Archive id for web items.

### Rules

- Existing untriaged captures remain inbox items.
- Degraded and failed non-superseded archives with unresolved review appear as `archive_recapture`.
- Good non-superseded archives within the recent review window and unresolved review appear as `archive_recent`.
- Recently captured items auto-resolve to `auto-kept` after the settling period.
- Count displays must describe useful judgment, not overdue backlog.

## Action Row

Reusable keyboard-first action set attached to an inbox item.

### Fields

- `action`: Stable action key.
- `label`: Positive verb shown to the user.
- `shortcut`: Keyboard shortcut hint.
- `tone`: Visual treatment such as primary, neutral, or destructive.

### Variants

- Capture: Keep, Archive, Promote, Task, Skip.
- Archive recapture: Re-capture, Delete, Skip.
- Archive recent: Keep, Archive, Re-capture, Skip.

### Rules

- Skip is always present.
- Shortcuts must not fire while text entry or assistive interactions own focus.
- Labels must not use close/dismiss metaphors for user decisions.

## Notification Posture

User setting that controls attention relay behavior and surface prominence.

### Values

- `quiet`: Suppress relay messages; state waits in surface.
- `standard`: Send relay messages for true actionable items such as recapture.
- `active`: Also allow relay messages for optional recently captured archive review.

### Rules

- Pending state remains in spine/surface regardless of relay success.
- Routine indexing, sync, successful background storage, and resurfacing do not send messages.

## Attention Message

Context sent to the Signal relay for user attention.

### Fields

- `type`: `archive_recapture`, `archive_recent`, or future actionable type.
- `title`: Page title or URL fallback.
- `url`: Source URL when available.
- `archive_id`: Archive identifier for correlation.
- `quality`: Technical quality when relevant.
- `body`: Concise explanation and phone-action context.

### Rules

- Sending is best-effort and never blocks archive persistence.
- Messages must contain enough context to understand the item without opening surface first.
