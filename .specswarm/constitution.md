# Constitution

> Project governance and coding principles. Each `## ` heading is a principle.
> Add an HTML-comment `<!-- specswarm-rule: ... -->` block beneath any principle
> you want SpecSwarm to enforce mechanically via PostToolUse hooks.
>
> Rule types: no-pattern, required-pattern, required-pair (full reference:
> `plugins/ss/lib/constitution-parser.sh`). Each block accepts `severity: warn | block`
> (default `warn`).

---

## P1. TypeScript for all new web source

All new source under `surface/src` and `spine/src` is TypeScript. JavaScript
source files are not added to these trees; the Rust agent is the only non-TS
component and lives under `agent/`.

**Why:** Strict TypeScript across spine and surface is what keeps the shared
REST contract honest and prevents type drift between server and client.

<!-- specswarm-rule: no-pattern -->
<!-- path-glob: **/src/**/*.js -->
<!-- bad-pattern: . -->
<!-- summary: New web source must be TypeScript, not JavaScript -->
<!-- severity: warn -->

---

## P2. Normalize document content before QMD structuredSearch

When invoking QMD's `structuredSearch` (the pre-expanded `store.search({ queries })`
path), document-sourced content must be normalized first: collapse newlines,
strip unbalanced quotes, and remove leading negation dashes. The single
normalization chokepoint is `search()` in `spine/src/search.ts`.

**Why:** QMD's `structuredSearch` throws synchronously on newlines, unbalanced
quotes, and FTS negation dashes. Markdown working-doc content triggers all three,
which surfaced as consistent ~55ms 500s on `/api/similar`. See project memory
`project_qmd_structuredsearch_validation`.

<!-- specswarm-rule: required-pair -->
<!-- path-glob: spine/src/**/*.ts -->
<!-- trigger-pattern: structuredSearch -->
<!-- pair-pattern: (normaliz|sanitize) -->
<!-- summary: structuredSearch callers must normalize document content first -->
<!-- severity: warn -->

---

## P3. Spine binds localhost only

The spine server binds to localhost exclusively. Caddy is the only process that
talks to it from outside the host. No code path exposes spine on a public
interface.

**Why:** Lattice owns all of a person's captured content. The trust boundary is
the single reverse proxy; widening it is a data-exposure risk, not a feature.

---

## P4. Capture is one motion; never require organization

Capturing or tracking something must never demand a category, name, or
"is this worth it" decision. There is no taxonomy and no naming standard.
Duplicate or differently-worded records are a retrieval problem solved at
retrieval time, never a capture-time obligation.

**Why:** The moment capture requires a decision, the habit dies. Friction at the
point of capture is the failure mode the whole system is designed to avoid
(`docs/tracking-design-principles.md`).

---

## P5. Tests accompany features; bugfixes start with a regression test

New features ship with tests. Bug fixes begin by writing a failing regression
test that reproduces the bug, then make it pass (`/ss:bugfix` workflow). The
relevant suite is the component's own: `bun test` (spine), Vitest/Playwright
(surface), `cargo test` (agent).

**Why:** A regression test is the only durable proof a bug is fixed and stays
fixed; a feature without tests is a future regression waiting to happen.

---

## P6. No em dashes in authored prose or output

Authored prose, commit messages, comments, and generated output use plain
hyphens or colons, never em dashes. (Not mechanically enforced: existing docs
and source already contain em dashes, so a hook would be all noise; this is a
forward-looking authoring rule.)

**Why:** Em dashes are an AI-output tell the maintainer cannot easily type and
has asked to avoid (memory `feedback_no_emdash`).

---

<!-- ss:user-additions -->
<!-- Add your principles below. Content here is preserved on /ss:init re-run. -->
<!-- ss:end -->
