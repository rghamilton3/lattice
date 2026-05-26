# Data Model: Working Docs

## Working Document

Represents one markdown note managed inside the workbench.

Fields:

- `slug`: Stable route/file identifier derived from title; lowercase letters, digits, and hyphens only.
- `title`: User-visible title extracted from the first level-one markdown heading when present; otherwise falls back to slug.
- `content`: Full markdown source body preserved exactly as saved.
- `modified_at`: Last modification timestamp for sorting and recency display.

Validation:

- Slug must match `^[a-z0-9-]+$` for read, update, and delete operations.
- Creating a document requires a title that produces a non-empty slug.
- Creating a document fails on duplicate slug to avoid overwriting existing notes.
- Content may be empty or heading-less.
- Missing documents return a recoverable not-found response.

## Working Document List Item

Represents a compact item for browsing working documents.

Fields:

- `slug`: Document identifier used to open the document.
- `title`: User-visible title.
- `modified_at`: Last modification timestamp.

Validation:

- List items are sorted newest-first by `modified_at`.
- Files that disappear during listing are skipped rather than crashing the list.
- Unreadable documents surface a clear server error instead of partial corrupt data.

## Editor State

Represents the user's current interaction with an open working document.

Fields:

- `slug`: Open document identifier.
- `content`: Current editor text.
- `isDirty`: Whether editor text has unsaved changes.
- `saveStatus`: Empty, saved, or error state for user feedback.
- `saveError`: Error message when a save fails.

Validation:

- Save operations target an existing slug.
- Save status must be visible and announced when it changes.
- Deletion or missing-document errors must not break the surrounding workbench pane.
