# Research: Working Docs

## Decision: Store Working Documents as Local Markdown Files

Use markdown files under the working directory derived from the configured database path.

**Rationale**: This matches the existing Lattice local-first model, keeps documents inspectable and portable, and avoids a new database schema for simple source markdown content.

**Alternatives considered**:

- SQLite document table: rejected because it adds migration complexity without improving the current single-user local-file workflow.
- External document service: rejected because it violates self-hosting and local-first constraints.

## Decision: Use Slugs as Document Identifiers

Derive a slug from the title, allow only lowercase letters, digits, and hyphens, and use that slug for route paths and filenames.

**Rationale**: Slugs are user-recognizable, stable enough for opening documents, and constrain filesystem access to expected filenames.

**Alternatives considered**:

- Random ids: safer for collisions but less inspectable and unnecessary for the current local single-user scope.
- Raw title filenames: rejected because title characters can create unsafe or inconsistent paths.

## Decision: Preserve Markdown Source Exactly

Treat document content as source markdown and preserve user-entered text verbatim during create/update/read cycles.

**Rationale**: The spec prioritizes working notes and markdown source editing. Unexpected formatting rewrites would undermine user trust.

**Alternatives considered**:

- Normalize markdown on save: rejected because it changes user content and introduces scope beyond document persistence.

## Decision: Use Existing Workbench Editor Flow

Continue using the CodeMirror editor pane with autosave and explicit status feedback, improving accessibility labels and status announcements where needed.

**Rationale**: The editor already exists in the workbench and supports markdown plus optional Vim mode. Reusing it avoids new dependencies and preserves the user's current workflow.

**Alternatives considered**:

- Add a separate rich-text editor: rejected as out of scope and dependency-heavy.

## Decision: Record Accessibility Evidence

Add feature evidence under `docs/accessibility/working-docs.md` covering keyboard flow, focus, labels, status messages, and contrast expectations.

**Rationale**: Working docs add core user-facing editor interactions. Evidence is required by the A11Y governance preset and supports WCAG 2.2 AA validation.
