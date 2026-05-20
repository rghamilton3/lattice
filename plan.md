# Lattice — Implementation Plan

A personal knowledge management system designed around ADHD-aware constraints: capture loosely, retrieve intelligently, no required rituals. The system's user-facing surface is intentionally thin; the heavy lifting lives in the retrieval layer and the federated indexing architecture.

This plan is a sequence of usable milestones, not a feature checklist. Each phase leaves you with something you actually use. If a phase starts to feel like it's going to take more than a week or two, the right move is to scope it down, not push through.

---

## Architecture summary

- **Spine** — TypeScript on Bun, using Elysia. Lives on the VPS. Owns the SQLite database, hosts QMD as a library, serves the API and the surface's static assets. Source of truth for all owned content (inbox, working docs, references, archive, annotations).
- **Indexer agent** — Rust binary, per personal machine. Watches/polls configured directories, extracts text, hashes, posts `{ machine_id, path, hash, text, metadata }` to the spine. The spine does the embedding. No local index.
- **Surface** — SvelteKit SPA, served by the spine. The only desktop UI for Lattice. Real editor (CodeMirror 6 with vim mode), inline rendering for markdown / Mermaid / KaTeX / PDF, multi-pane workbench.
- **Capture paths** — phone via Signal→Hermes→spine, personal desktop via hotkey overlay → spine, work machine via browser form (deferred). All converge on one endpoint.
- **Auth** — Caddy + Authelia forward auth for the surface (browser sessions). Bearer-token bypass for `/api/agent/*` routes (programmatic).
- **Sync model** — VPS is the source of truth for owned content; local indexed files stay where they are. Single-editor assumption means no merge / CRDT code needed. Polling + on-demand fetch.

---

## Phase 0 — Standalone preconditions

**Goal**: Things that genuinely don't depend on anything else existing.

**Scope**:

- DNS for `lattice.rghsoftware.com` pointed at the VPS.
- Repo skeleton: three sibling directories — `spine/`, `agent/`, `surface/` — under a single `lattice/` root. `Justfile` at root for common dev commands. No monorepo tooling.
- Backup target decided and tested. Pick something concrete (S3-compatible, rclone to another box, restic to wherever) and confirm you can write to it from the VPS. **Do not skip this.** Pick the target before any code touches data.
- Generate the agent bearer token: `openssl rand -base64 32`. Store it somewhere safe (password manager). For v1, one shared token across agents is fine.
- Decide SQLite path on VPS (e.g. `/var/lib/lattice/lattice.db`) and create the directory with correct permissions.

**Deferred**: Caddy config (moves to Phase 1, where it has something to route to).

**Done when**: You can `ls /var/lib/lattice/`, you have the bearer token recorded, you have a backup target you've successfully written a test file to, and the three repo directories exist with empty `README.md` files.

---

## Phase 1 — Capture and inbox, end-to-end

**Goal**: Thoughts land on the spine and persist. Auth works end-to-end for both the surface (browser) and the agent (bearer token).

**Scope**:

### Spine

- Bun + Elysia app skeleton in `spine/`.
- SQLite via `bun:sqlite` (or `better-sqlite3` if you prefer; both are fine).
- Schema:

  ```sql
  CREATE TABLE captures (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    text TEXT NOT NULL,
    source TEXT NOT NULL,        -- 'signal', 'desktop-hotkey', 'web', etc.
    captured_at TEXT NOT NULL,   -- ISO 8601, client-provided
    ingested_at TEXT NOT NULL    -- ISO 8601, spine-set
  );
  ```

- Migrations: simple numbered SQL files in `spine/migrations/`, applied on startup. Don't reach for an ORM yet.
- Routes:
  - `POST /api/agent/capture` — accepts `{ text, source, captured_at }`, validates with TypeBox, inserts, returns `{ id }`. Bearer-token auth.
  - `GET /api/captures?limit=N` — returns recent captures. Authelia auth (browser).
  - `GET /ping` — health check, no auth.
- Auth middleware:
  - Bearer-token middleware for routes matched by `/api/agent/*`. Token in env var `LATTICE_AGENT_TOKEN`.
  - Authelia trust for everything else — read `Remote-User` from headers, reject if missing.
- Bind to localhost only. Caddy is the only thing that talks to the spine.

### Caddy

- Site config for `lattice.rghsoftware.com`:
  - `/api/agent/*` routes bypass Authelia, reverse-proxy to the spine.
  - Everything else uses forward auth to Authelia at `auth.rghsoftware.com`, then reverse-proxies to the spine.
- Reload Caddy, verify TLS works.

### Capture paths

- **Phone**: redirect your existing Signal→Hermes pipeline to POST to `https://lattice.rghsoftware.com/api/agent/capture` with the bearer token. Source field: `signal`.
- **Personal desktop**: minimum viable. Use Raycast / Alfred / Hammerspoon / Rofi (whichever matches your OS) to bind a hotkey that prompts for text and POSTs to the spine. Source field: `desktop-hotkey`. Skip clipboard awareness, context capture, and file attachments for now.

### Trivial UI

- A single static HTML file served by the spine at `/`. Lists the last 50 captures. No styling effort beyond legibility. Exists only to verify captures are landing.

**Deferred**:

- Work-machine browser form.
- Clipboard awareness, active-window context.
- File attachments, voice transcription, image OCR.
- Real frontend framework (Phase 4).

**Done when**: You've captured at least 20 real thoughts over a couple of days from at least two devices, and you can see them all in the static HTML list. Don't move on until capture feels reflexive — this is the load-bearing habit for everything else.

**Time estimate**: One weekend, give or take an evening.

---

## Phase 2 — Basic retrieval

**Goal**: You can find things you've captured.

**Scope**:

- Add QMD as a dependency in `spine/`.
- Configure a QMD collection pointed at the spine's SQLite (or a directory the spine writes captures to as markdown files — depends on whether QMD is happiest indexing the DB directly or a filesystem). If filesystem-based: spine writes each capture to `/var/lib/lattice/captures/<id>.md` on insert, QMD indexes that directory.
- Run the embedding step (`qmd embed`) — either ad-hoc or via a startup task.
- New route: `GET /api/search?q=<query>` — runs `qmd query`, returns JSON results with `{ id, score, snippet, path }`.
- Trivial search page: search box at the top of the static HTML, results list below. Click a result, see its full text. No frames, no panes. Authelia-authed.

**Deferred**:

- The real reading surface (Phase 4).
- Lateral movement queries.
- Anything beyond "type a query, see results."

**Done when**: You can search for something you captured a few days ago and find it. Try real queries from your actual life, not synthetic ones. If QMD's defaults aren't working well on your corpus, tune now — when the surface is throwaway HTML and easy to iterate against.

**Time estimate**: One or two evenings.

---

## Phase 3 — The local indexer agent

**Goal**: One personal machine's local files are discoverable from the spine. This is the architectural pivot point.

**Scope**:

### Agent (Rust)

- Cargo project in `agent/`.
- Config file at `~/.config/lattice/agent.toml`:

  ```toml
  spine_url = "https://lattice.rghsoftware.com"
  agent_token = "..."         # bearer token
  machine_id = "personal-laptop"

  [[watch]]
  path = "/home/user/Documents/notes"
  patterns = ["**/*.md", "**/*.txt", "**/*.pdf"]
  ```

- For v1: poll every N minutes rather than fsnotify. Simpler, more reliable, fine for "noticed within an hour" use cases.
- For each file in scope:
  - Hash the file content (BLAKE3 or SHA-256).
  - Skip if `(machine_id, path, hash)` already known (track in a tiny local SQLite cache).
  - Extract text:
    - Markdown / txt: read directly.
    - PDF: `pdf-extract` crate or shell out to `pdftotext`.
    - Skip unknown types for now; log them.
  - POST to `/api/agent/index`:

    ```json
    {
      "machine_id": "personal-laptop",
      "path": "/home/user/Documents/notes/foo.md",
      "hash": "...",
      "mime_type": "text/markdown",
      "text": "...",
      "modified_at": "...",
      "size_bytes": 1234
    }
    ```

- Daemonize via user-level systemd (Linux), launchd (macOS), or Task Scheduler (Windows). No admin privileges required.

### Spine

- New table:

  ```sql
  CREATE TABLE local_files (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    machine_id TEXT NOT NULL,
    path TEXT NOT NULL,
    hash TEXT NOT NULL,
    mime_type TEXT,
    text TEXT NOT NULL,
    modified_at TEXT,
    size_bytes INTEGER,
    indexed_at TEXT NOT NULL,
    UNIQUE(machine_id, path, hash)
  );
  ```

- Route: `POST /api/agent/index` — validates, upserts on `(machine_id, path, hash)`. Idempotent.
- QMD configured to index `local_files` as a second collection (or, if filesystem-based, write each entry to `/var/lib/lattice/local/<machine_id>/<hash>.md` for QMD to pick up).
- Search results now include both captures and local files, tagged with their location (`source: capture` or `source: local-files`, plus `machine_id` for the latter).

### Trivial UI

- Update the search page to show location tags on results. Same-machine local files get a "open natively" link (custom URL handler — set up later, can be left as a no-op for now); other-machine local files just show "on `<machine_id>`".

**Deferred**:

- On-demand fetch of remote files (Phase 6+).
- Multiple machines (prove it on one first).
- Annotations on local files (Phase 6).
- Sophisticated file-type handling (Office docs, code repos, etc.).
- Native file opening (custom URL handler).

**Done when**: You can search for a phrase that exists in a local PDF and find it. The federated model is now real.

**Time estimate**: Weekend plus an evening. The Rust side might feel slow if you're rusty; budget accordingly.

---

## Phase 4 — Minimum reading surface

**Goal**: A real workbench. Not just a search results page.

**Scope**:

### SvelteKit app in `surface/`

- Built as a SPA, output as static files, served by the spine from `/`.
- `@tanstack/svelte-query` for data fetching.
- CodeMirror 6 with vim mode (`@replit/codemirror-vim`) for any editable text view.
- Markdown rendering via `marked` or `markdown-it`, with Mermaid and KaTeX plugged in.
- PDF rendering via PDF.js.

### Views

- **Search view**: query box, results list with snippets, location tags. Each result clickable.
- **Reading view**: opens a capture / local file / working doc in a pane. Renders appropriately based on type.
- **Two-pane layout**: at minimum, you can have two reading views side by side. Open-in-right-pane action from the search view and from inside an existing pane.

### Lateral movement queries

Three buttons / keyboard shortcuts inside any open doc:

- **More like this** → semantic neighbors via QMD vector search.
- **Mentions of `<selection>`** → text search constrained to the highlighted phrase.
- **Around this in time** → captures and files from a window around this doc's timestamp.

Each opens results in the other pane (or as a result list overlay if both panes are committed).

### Working docs

Working docs are just markdown files in a `working/` container, indexed like everything else. From the surface:

- **New working doc** action — creates an empty markdown file in `working/`, opens it in an editable pane.
- **Promote to working doc** action — from any reading view or result list, creates a new working doc seeded with the current content / selection.

**Deferred** (genuinely v2):

- Annotations (Phase 6).
- Diagram authoring (Phase 6).
- Cluster-as-view (Phase 7).
- Resurfacing panel (Phase 7).
- More than two panes.
- Workspace state persistence across sessions.
- Open-in-neovim escape hatch (deliberately not in the system; only revisit if Phase 5 friction demands it).

**Done when**: You can run a search, open a result, follow "more like this" to a related doc, hold both open side by side, and create a working doc seeded from a selection — without feeling like you're missing anything critical for daily use.

**Time estimate**: Two to three weekends. This is the biggest phase. The most likely scope-creep is wanting it to look nice; resist until Phase 5 is done. The point is _the shape exists_, not _the surface is polished_.

---

## Phase 5 — First real use period

**Goal**: Catch what the design got wrong before adding more.

**Scope**:

- Zero new features.
- Bulk-import old PKM data into an `archive` collection. This is just pointing the indexer at the old directories. Do not curate. Do not read through it. Do not "clean it up." The archive is searchable and excluded from active surfacing.
- Use the system for everything for at least two weeks. Capture into it. Search in it. Open things in the surface. Start working docs.
- Keep a log of friction in a working doc within the system itself. Note:
  - Captures you wanted to make but didn't (and why).
  - Things you couldn't find that should have been findable.
  - Times you fell back to old habits (paper, notes app, memory).
  - Moments where the surface felt wrong.
  - Anything that surprised you.

**Deferred**: Everything except observation.

**Done when**: You have a real list of observed friction and can prioritize Phase 6+ against it, rather than against what we _imagined_ would be friction during design.

**Time estimate**: Two to four weeks of real-time, no active development.

---

## Phase 6 — Annotations and diagram authoring

**Goal**: The surface stops being read-only.

**Scope**:

### Annotations

- New schema:

  ```sql
  CREATE TABLE annotations (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    target_kind TEXT NOT NULL,    -- 'capture', 'local_file', 'working'
    target_id TEXT NOT NULL,      -- captures.id, hash, or working doc path
    selection_start INTEGER,
    selection_end INTEGER,
    selection_text TEXT,          -- denormalized for display when target changes
    comment TEXT NOT NULL,
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL
  );
  ```

- API routes: `POST /api/annotations`, `GET /api/annotations?target=...`, `DELETE /api/annotations/:id`.
- Surface: highlight any text → comment popup → save. Annotations render inline (highlight + marginal note or footnote-style).
- Annotations are indexed by QMD alongside source content, so searching for what you wrote in an annotation finds the original doc.

### Diagram authoring (Mermaid only for this phase)

- Mermaid blocks in markdown render to SVG live.
- Embedded Mermaid editor: in any working doc, "insert diagram" creates a fenced ` ```mermaid ` block with an inline preview pane. Edit the source on one side, see the rendered diagram on the other.
- Diagrams are just text — no special storage. Searchable by their source content.

**Deferred**:

- Freeform canvas (tldraw / Excalidraw) — decide after Mermaid is in use. If the freeform case turns out to be important, embed the React component as a micro-app or accept the Svelte port if one matures.
- Image annotation, OCR for raster images.

**Done when**: You can highlight a passage in a doc, comment on it, find your comment via search later. You can create a Mermaid diagram in a working doc and have it render inline.

**Time estimate**: One weekend if scoped to Mermaid only.

---

## Phase 7 — Resurfacing and clustering

**Goal**: The system gets a "what's on my mind" surface.

**Scope**:

- Wire your existing clustering / resurfacing logic into the spine. If it's a separate Python or Rust thing, run it as a sidecar process or scheduled job.
- Cron on the spine (or a `setInterval` in the spine process — depends on what's cleanest) runs the resurfacing pass nightly. Writes results to:

  ```sql
  CREATE TABLE surfaced (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    target_kind TEXT NOT NULL,
    target_id TEXT NOT NULL,
    surfaced_at TEXT NOT NULL,
    reason TEXT,                  -- 'recency', 'cluster-centroid', 'stale-but-relevant', etc.
    dismissed_at TEXT
  );
  ```

- Surface: a quiet panel on the landing page showing today's surfaced items. Visible on arrival, invisible once you're inside a doc.
- No streaks, no unread counters, no guilt. Dismissed surfacings cost nothing.

### Cluster-as-view

- URL like `/cluster/:id` shows a cluster's contents as a browseable list.
- "Show cluster" affordance on any doc opens the cluster that doc belongs to.

**Deferred**:

- LLM-classifier-mediated promotion of stale working docs (Phase 8+).
- Task routing (Phase 8+).

**Done when**: You arrive at the surface in the morning, see what was surfaced, and engage with it (or not) without it feeling like a notification feed.

**Time estimate**: One weekend, assuming the clustering logic is already built.

---

## Phase 8+ — Driven by real friction

After Phase 7, the next moves depend entirely on what Phase 5's log and continued use have revealed. Likely candidates, in no particular order:

- **Classifier-driven task routing** — captures with explicit dates get piped to a task channel automatically. Classifier as routing layer, not categorization.
- **Cron-and-classifier doc promotion** — stale working docs get summarized by an LLM and presented with a "what is this doc's state?" prompt. One-click approve or reject, no editing.
- **Freeform canvas** — tldraw or Excalidraw embed, if Mermaid proves insufficient.
- **Image annotation, OCR** — for screenshots and image captures.
- **Voice capture transcription** on the spine.
- **Additional indexer agents** on other personal machines.
- **Work-machine browser form** — minimal capture path for the locked-down environment.
- **On-demand cross-machine file fetch** — the surface pulls a remote file's contents from another machine's agent.
- **Per-machine agent tokens** — promote from one shared token to a token-per-machine model.
- **"Edit in neovim" escape hatch** — only if the web editor genuinely proves insufficient for long-form work. Currently not in the system; revisiting is a real decision, not a reflex.

Do not plan these specifically before Phase 5. Let real use drive prioritization.

---

## Cross-cutting concerns

These aren't phases — they're things to keep right throughout.

### Backups

The spine is a single point of failure for everything you care about. SQLite backup script running daily to off-VPS storage from day one (decided in Phase 0). Test the restore path once before Phase 5; otherwise backups are theatre.

### Migrations

When schemas change, write a numbered migration SQL file in `spine/migrations/`. Apply on startup. Don't `ALTER TABLE` by hand. The migrations directory is the source of truth for the schema.

### Template-tweak discipline

The "don't redesign templates" rule applies recursively to the system itself. You will be tempted to redesign the schema, switch frameworks, restructure the API. Each is the meta-version of the template-tweak trap. Build forward; refactor only when use demands it.

If you find yourself wanting to revise the architecture before you've written a meaningful amount of code in a phase, that's the meta-tweaking pattern. Catch it.

### One environment

You're the only user. Your dev environment is your prod environment. Don't set up staging. If you break it, fix it. Backups cover the disaster case.

### Idempotency at boundaries

The agent will absolutely re-send the same payload under various conditions (restart, crash, polling overlaps). The spine should dedupe on `(machine_id, path, hash)` and treat re-sends as no-ops. Design this in; retrofitting is painful.

### HTTPS only

Spine refuses non-HTTPS requests. Caddy handles TLS, but defense in depth — if Caddy ever misroutes, the spine fails closed.

### Shared types (optional)

If you want type safety across the Rust ↔ TypeScript boundary, look at the `ts-rs` crate. Generates TypeScript types from your Rust structs. Optional but useful once the wire format stabilizes.

---

## Honest time estimate

Part-time, evenings and a weekend day per week, disciplined scope:

- Phase 0: a few hours.
- Phase 1: a weekend.
- Phase 2: an evening or two.
- Phase 3: a weekend plus an evening.
- Phase 4: two to three weekends.
- Phase 5: two to four weeks of real-time, no development.
- Phase 6: a weekend (Mermaid only).
- Phase 7: a weekend.

Roughly six to ten weeks of part-time work to reach the end of Phase 7, with multiple weeks of just-using-it embedded in the middle. Total active build time around 30–40 hours.

If something takes twice as long: fine, projects do that. If something takes five times as long: stop, re-read the phase scope, and find what scope crept.

---

## Definition of "done" for the whole project

There isn't one. Lattice is a system you'll use indefinitely and evolve as your needs change. The thing you're building toward is not a finished product but a _working substrate_ — a place where capture is reflexive, retrieval is trustworthy, and the surface supports actual thinking. Phase 7 is roughly where it crosses from "interesting experiment" to "the place my thinking lives." Everything after that is refinement against real use.

The thing to most avoid: building Phase 4 perfectly before using Phases 1–3. The surface is the most aesthetically appealing thing to build, and also the thing whose right shape depends most on having real data first. Do the unglamorous foundation phases on schedule and let the surface come when it's earned.
