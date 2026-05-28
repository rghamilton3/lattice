# Lattice — Implementation Plan

A personal knowledge management system designed around ADHD-aware constraints: capture loosely, retrieve intelligently, no required rituals. The system's user-facing surface is intentionally thin; the heavy lifting lives in the retrieval layer and the federated indexing architecture.

This plan is a sequence of usable milestones, not a feature checklist. Each phase leaves you with something you actually use. If a phase starts to feel like it's going to take more than a week or two, the right move is to scope it down, not push through.

---

## Architecture summary

- **Spine** — TypeScript on Bun, using Elysia. Lives on the VPS. Owns the SQLite database, hosts QMD as a library, serves the API and the surface's static assets. Source of truth for all owned content (inbox, working docs, references, archive, annotations).
- **Indexer agent** — Rust binary, per personal machine. Watches/polls configured directories, extracts text, hashes, posts `{ machine_id, path, hash, text, metadata }` to the spine. The spine does the embedding (via the inference layer below). No local index.
- **Surface** — SvelteKit SPA, served by the spine. The only desktop UI for Lattice. Real editor (CodeMirror 6 with vim mode), inline rendering for markdown / Mermaid / KaTeX / PDF, multi-pane workbench.
- **Inference layer** — Ollama on RunPod serverless, serving QMD's three GGUF models (embedder, reranker, expansion) via an OpenAI-compatible API. Spine talks to it through QMD's `RemoteLLM` path (adopted from upstream PR #629 + Kaspre's documented fixes). Same infrastructure becomes the substrate for additional model workloads in Phase 9+.
- **Capture paths** — phone via Signal relay → spine, personal desktop via hotkey overlay → spine, browser content via SingleFile extension → spine. All converge on one endpoint, with slash-command categorization (`/capture`, `/url`, etc.) for opt-in structure.
- **Notification channel** — self-built Signal relay (via signal-cli) for "attention" pings. Pending-action state lives in the surface, not in notifications. Ephemeral notifications are an ADHD anti-pattern for actionable items and are deliberately avoided.
- **Auth** — Caddy + Authelia forward auth for the surface (browser sessions). Bearer-token bypass for `/api/agent/*` routes (programmatic). Same bearer-token model for Spine → Ollama on RunPod.
- **Sync model** — VPS is the source of truth for owned content; local indexed files stay where they are. Single-editor assumption means no merge / CRDT code needed. Polling + on-demand fetch.

---

## Status as of this revision

Phases 0–4 are complete and the system is in real daily use. Phase 5 (web archival) is in progress. Phase 6 (inference offload) is the new immediate next step; it was promoted from a Phase 9+ deferred item after the QMD pipeline was empirically shown to be unworkable on the current VPS (full hybrid search >1 minute on CPU, eval bakeoff confirmed the fine-tuned expansion model can't be cleanly replaced with a hosted API).

Phase 6's scope is dramatically smaller than first drafted because upstream work already exists: PR #629 in `tobi/qmd` adds OpenAI-compatible remote inference (`RemoteLLM` + `HybridLLM` routing), with 36 unit + 30 integration tests, endorsed in production by a third party at sub-second warm-query latency. The remaining work is adopting #629, applying three documented follow-up fixes, and deploying an OpenAI-compatible inference server.

---

## Phase 0 — Standalone preconditions ✅

**Done.** DNS, repo skeleton, backup target, agent token, SQLite path.

---

## Phase 1 — Capture and inbox, end-to-end ✅

**Done.** Spine + Elysia + SQLite. Auth wired through Caddy + Authelia for the surface; bearer-token middleware for `/api/agent/*`. Phone (Signal) and desktop hotkey capture both working.

---

## Phase 2 — Basic retrieval ✅

**Done.** QMD integrated as a library. Search returns reasonable results on real captures.

---

## Phase 3 — The local indexer agent ✅

**Done.** Rust agent running on at least one machine. Local files appearing in search results with location tags. The federated model is proven.

---

## Phase 4 — Reading surface ✅

**Done.** SvelteKit SPA. CodeMirror 6 with vim mode. Multi-pane workbench. Lateral movement queries (more like this, mentions of, around this in time). Working doc creation and promotion. Slash-command categorization for captures.

UI patterns established during this phase that subsequent phases should preserve:

- **"Where you were" landing frame** — implies continuity, not obligation.
- **Notification posture toggle** (Quiet / Standard / Active) — single coherent setting that adjusts both Signal-relay aggressiveness and surface-side prominence. Three settings deliberately; more would invite tweaking.
- **Positive-dismissal action rows** on inbox items (Keep / Archive / Promote / Task / Skip with keyboard shortcuts). Every verb is an intent; no "X" / "close" / "dismiss." Skip is first-class as a deferred non-decision.
- **Frictionless escape hatches** — "Archive all read" and time-boxed batch actions. Should be revisited if framing implies a performance metric (e.g. "Process 10 in 5 min" may want softening to "Quick batch").
- **Honest subtitles** — naming the design intent in-UI ("Pick up, or capture something new. No streaks, no overdue.") is good discipline. Use sparingly; two or three across the product is character, ten is a manifesto.

---

## Phase 5 — Web archival and inbox evolution

**Goal**: Web content becomes a first-class content category. The inbox absorbs new item types (failed archives needing re-capture, recently-captured archives awaiting light review) without becoming a parallel queue system. Notifications use the Signal relay for attention only; pending-action state stays in the surface.

### Background

Web pages are a third content category alongside owned content (captures, working docs, annotations) and local-indexed content (files on personal machines). They need to be archived as bytes — not just referenced as URLs — because URLs are unreliable on a multi-year timeline. The naive approach (server-side URL-to-archive via monolith) fails on JS-rendered sites, which are common for the kinds of docs worth saving.

The architecture: two complementary capture paths writing to one archive table. SingleFile (browser extension) for client-side capture of fully-rendered, possibly-logged-in pages. Monolith (server-side) for URL-only triggers from contexts without a browser (mobile share sheet, hotkey, scripted). Failed or degraded server-side archives are flagged for re-capture via SingleFile, surfaced through the inbox.

### Scope

**Spine — archive storage and pipeline**:

- New table:
  ```sql
  CREATE TABLE archives (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    url TEXT NOT NULL,
    title TEXT,
    archived_at TEXT NOT NULL,
    captured_via TEXT NOT NULL,        -- 'singlefile', 'monolith', etc.
    hash TEXT NOT NULL,                -- of the archived file
    archive_path TEXT NOT NULL,        -- /var/lib/lattice/web/<hash>.html
    extracted_text TEXT NOT NULL,
    source TEXT,                       -- 'browser-ext', 'mobile-share', 'hotkey', etc.
    why_saved TEXT,                    -- optional one-line note at capture time
    quality TEXT NOT NULL DEFAULT 'good', -- 'good', 'degraded', 'failed'
    supersedes INTEGER REFERENCES archives(id)
  );
  ```
- `quality` is **technical quality** (did the pipeline produce a usable artifact), not **editorial quality** (is the content worth keeping). Lorem ipsum and SEO-farm content get `quality = 'good'` if monolith captured them cleanly. Editorial judgment belongs to the user.
- Routes:
  - `POST /api/agent/archive-page` — SingleFile path. Accepts multipart: archived HTML + URL + title + optional why_saved. Stores file, extracts text, indexes via QMD.
  - `POST /api/agent/archive-url` — monolith path. Accepts URL + optional why_saved. Spine queues a job, runs monolith, classifies quality, stores result.
- Quality classification on monolith output: heuristics for "extracted text suspiciously short," "page contains 'enable JavaScript' markers," "HTML is mostly empty `<div id="root">` shape." Mark as `degraded` rather than `good` when these fire. The classifier's job is **technical**, not editorial.
- Re-capture supersession: when a SingleFile capture comes in for a URL with an existing degraded archive, mark the old one as superseded (don't delete it — storage is cheap, and the older capture may have salvageable bits).
- Search defaults to `quality = 'good' AND supersedes IS NULL`.

**SingleFile integration**:

- Start with stock SingleFile, configured to POST to `https://lattice.rghsoftware.com/api/agent/archive-page` with the bearer token. Only fork/customize if a missing feature warrants it.
- Optional: a minimal wrapper that prompts for the `why_saved` one-liner before submitting. Defer this until stock SingleFile is in use and the absence is felt.
- Mobile: SingleFile has limited mobile browser support. Mobile capture stays as "share URL → spine → monolith" with the understanding that JS-heavy pages will land as degraded and queue for re-capture.

**Monolith integration**:

- Install monolith on the spine.
- Background job runner (BullMQ or just an in-process queue for v1) processes archive-url requests.
- Run with reasonable defaults: include CSS, fonts, images, frames; exclude JS execution (monolith doesn't really do this anyway).
- Timeout aggressively (30s); a slow archive is a degraded archive.

**Inbox evolution**:

The inbox already handles captures with action rows. Extend it to absorb two new item types:

- **`recapture` items**: failed or degraded archives. Action row: `Re-capture (r)` / `Delete (d)` / `Skip (—)`. "Re-capture" opens the URL in a new browser tab; user hits SingleFile button; the new capture supersedes the old. "Delete" removes the archive entirely.
- **`recently-captured` items**: successful archives within a review window (e.g., last 24h). Action row: `Keep (k)` / `Archive (a)` / `Re-capture (r)` / `Skip (—)`. Auto-promotes to "kept" after a few days of just sitting — review is opt-in, not required.

Both share the existing positive-dismissal pattern. Add an item-type discriminator to the inbox model so action rows can vary.

**Notification posture and Signal relay**:

- Signal relay (self-built, signal-cli-based) sends "attention" messages when:
  - A `recapture` item enters the inbox (always).
  - Other actionable state requiring user input (future-proofing for classifier-routed items, working-doc-promotion prompts, etc.).
- Signal relay does **not** send for:
  - `recently-captured` items (optional review, doesn't deserve a ping).
  - Resurfacing (handled by surface-arrival visibility).
  - Routine indexing/sync events.
- Notification posture toggle ties to relay aggressiveness:
  - **Quiet**: relay suppressed entirely; everything waits in the surface.
  - **Standard**: relay fires for true actionable items only (default).
  - **Active**: relay also fires for recently-captured items, surfacing more aggressively.
- Each Signal message includes enough context to act from the phone if possible (title, URL, type). Don't make Signal messages a teaser requiring surface access.

**Positive-dismissal as a shared component**:

Extract the action-row pattern into a reusable Svelte component. Variants by item type. Keyboard shortcut handler shared. This pattern will recur (classifier review, working-doc-promotion prompts, future LLM-mediated workflows) and getting the abstraction right once saves friction later.

Critical properties of the component:

- Verbs, not "X." Every action is a positive intent.
- Keyboard-first; mouse-second.
- No count badges that imply debt. Counts that scale to "items needing my judgment" are fine; counts that imply backlog are not. The current Inbox "5" is acceptable because notification posture moderates it; revisit if it starts feeling pressuring.
- No streaks. No "overdue." No urgency theater.
- "Skip" is always available as a deferred non-decision.

### Deferred

- Headless browser on the spine for server-side rendering of JS-heavy URLs. Possible later if mobile-captured JS sites become a frequent friction. Comes with real ops cost (Chromium install, memory pressure, periodic updates).
- Per-site archival rules (e.g., "this domain always needs SingleFile, never try monolith"). Add when patterns become obvious.
- "Recently captured" daily digest via Signal. Maybe. Watch whether the surface-side review naturally happens; if not, consider a small nudge.
- Editorial-quality classification (is this content worth keeping). Stays user-judgment for the foreseeable future.

### Done when

- You can save a URL from your phone and find it later, even if the source goes offline.
- JS-rendered doc sites archive cleanly via the SingleFile path from desktop.
- Failed/degraded archives appear in the inbox with re-capture actions and produce a Signal ping.
- Recently-captured archives appear in the inbox for light review, no ping, auto-promote on inaction.
- Notification posture changes meaningfully affect both Signal aggressiveness and surface prominence.

---

## Phase 6 — Inference offload

**Goal**: QMD's hot path runs in under 2 seconds end-to-end instead of 60+. The Spine offloads model inference to Ollama running on RunPod serverless, removing the CPU bottleneck. Establishes the OpenAI-compatible inference layer that future ML workloads plug into without re-architecting.

### Background

Phase 0 through Phase 5 assumed QMD's three GGUF models (embeddinggemma-300M, qwen3-reranker-0.6B, qmd-query-expansion-1.7B) would run in-process on the VPS. They do — but at >60s per full hybrid query, badly enough that a "deep search" workaround was built to avoid the QMD path entirely. The hot path can't stay on CPU.

A bakeoff against Claude Haiku as a drop-in expansion replacement was decisive: 0 Haiku wins, 5 fine-tuned wins, 3 ties across 8 real queries, with only 20% result overlap. Hosted-API substitution loses meaningful retrieval quality. The fine-tuned expansion model needs to stay; it just needs to stay somewhere with a GPU.

The good news: upstream PR #629 (`tobi/qmd`) already does the QMD-side work. It adds OpenAI-compatible remote inference via a `RemoteLLM` class plus a `HybridLLM` routing layer that lets some operations remain local while others go remote. Tests are comprehensive (36 unit + 30 integration). A third party (Kaspre) endorses it in production with documented warm-query latency averaging ~720ms. They also documented three follow-up fixes needed in practice. PR #629 itself has been open without maintainer response for weeks; the maintainer's bandwidth isn't where this lives, so adoption happens via fork, not upstream merge.

The architectural shift: the Spine stops being the place where models run. It becomes the orchestrator that calls an OpenAI-compatible inference server. QMD keeps owning the retrieval pipeline (BM25, vector search, RRF fusion, blending) — those are cheap on CPU. Only the inference steps (embed, rerank, expand) leave the box.

### Why Ollama (and not vLLM or a custom container)

The OpenAI-compatible standard is what matters; the server behind it is a choice. Three real options were considered:

- **Ollama**: handles GGUF natively (which is what QMD's models ship as), serves multiple models from one instance, exposes an OpenAI-compatible API, easy RunPod deployment, well-documented. Lower theoretical throughput than vLLM but the difference is invisible at one-user scale.
- **vLLM**: faster at high QPS via PagedAttention batching, but needs non-GGUF model versions (the fine-tuned `qmd-query-expansion-1.7B` may only exist as GGUF), serves one model per instance, more configuration surface, and the throughput advantage is wasted at this scale.
- **Custom node-llama-cpp container**: maximum control but maximum maintenance burden. No real reason to take it on when Ollama already does the job.

Default for v1 is Ollama. Revisit if a specific workload outgrows it (vLLM becomes interesting if a generative workload needs serious throughput; a custom shim becomes interesting if a model isn't available in any standard server).

### Scope

**QMD adoption** (roughly a half-day of work):

- Fork `tobi/qmd` at a stable release (v2.5.1 is what Kaspre is running successfully — start there unless there's a reason to track newer).
- Cherry-pick the commits from PR #629 (branch `georgelichen:merge-pr-517-remote-llm`).
- Apply Kaspre's three documented fixes from the #629 comments:
  - **A.** Sigmoid normalization in `RemoteLLM.rerank` (~3 lines). Rerankers exposed via llama.cpp's `/v1/rerank` (and many cross-encoders) emit log-odds (~-10 to +10), not 0–1. QMD's blend formula assumes 0–1 and `--min-score 0.3` defaults exclude everything otherwise. `σ(x) = 1/(1+e^-x)` preserves ordering and fixes the range; no-op for rerankers already emitting 0–1.
  - **B.** Working `RemoteLLM.expandQuery` (~100 lines). Currently the method throws; this implementation POSTs to `<expand_api_url>/chat/completions` with a system prompt that gets the chat model to emit QMD's `lex:` / `vec:` / `hyde:` line-prefixed format. Parsing + fallback mirror `LocalLLM.expandQuery` shape.
  - **C.** Pre-flight probe at `vectorIndex()` startup (~30 lines). When `usesRemoteEmbedding === true`, a 1-token probe at startup catches config mistakes before any real work happens. Optional but cheap and prevents the "silent fallback embedded weeks of content with wrong model" failure mode Kaspre hit.
- Bump the Spine's QMD dependency to point at the fork (npm git-URL ref, or publish under a private name if cleaner).
- Reach out to Kaspre via the #629 thread offering to coordinate — there's some chance they'll just push their fork, which would save the patch work.

**Ollama deployment on RunPod**:

- Use a RunPod serverless endpoint with Ollama as the container.
- Configure to pull the three GGUF models on first cold start (cache to network volume so subsequent cold starts skip the download):
  - `embeddinggemma:300m`
  - `qwen3-reranker:0.6b` (verify the exact Ollama tag; may need to manually pull from HF if not in Ollama's registry)
  - `qmd-query-expansion:1.7b` (Tobi's fine-tune; may need a `Modelfile` to import the GGUF from HF)
- GPU class: start with RTX 4090 or A40 — overkill in compute but cheap and plenty of VRAM for the ~2GB of models plus context.
- FlashBoot enabled. Min workers: 0 (scale to zero between bursts). Max workers: 2. Idle timeout: 5 minutes — tune after a week of real measurements.
- Network volume for the model cache so workers don't re-download GGUFs on every cold start.
- Bearer token via env var (`OLLAMA_API_KEY` or similar; verify Ollama's current auth story — may need a small reverse proxy if it doesn't support tokens natively).
- Region: same coast as the VPS to keep Spine → inference latency in single-digit ms.

**Spine configuration**:

- New env vars (in `spine/.env`):
  - `QMD_EMBED_API_URL` — Ollama endpoint URL.
  - `QMD_EMBED_API_MODEL` — `embeddinggemma:300m` (or whatever the local Ollama tag is).
  - `QMD_RERANK_API_URL` — same endpoint.
  - `QMD_RERANK_API_MODEL` — `qwen3-reranker:0.6b`.
  - `QMD_EXPAND_API_URL` — same endpoint.
  - `QMD_EXPAND_API_MODEL` — `qmd-query-expansion:1.7b`.
  - `QMD_API_KEY` — bearer token, shared across all three.
- Spine's QMD store creation passes these through QMD's existing config plumbing. With #629 + Kaspre's fixes applied, no Spine code changes are needed beyond env wiring — the routing is internal to QMD.
- Graceful degradation: if the Ollama endpoint is unreachable, QMD's `HybridLLM` already falls back where it can (BM25 still works). Verify the user-visible behavior in the Surface — a "search is in keyword-only mode (deep search offline)" indicator is necessary information, not a hidden failure.

**Observability**:

- Spine logs every QMD search call with `{ workload, latency_ms, used_remote: bool, fell_back: bool }`. Pino is already there; just structure the fields.
- A `lattice cost` CLI subcommand (or surface admin panel) that reads RunPod's billing API weekly and shows: total spend, spend by workload, avg latency by workload, cold-start rate.
- RunPod billing alert in the console at 2× expected monthly cost.

### Deferred

- Splitting models across multiple Ollama instances. One instance per RunPod endpoint is simpler.
- vLLM swap. Only worth the work if throughput becomes a measurable bottleneck — won't at one-user scale for years.
- Multi-region or multi-provider failover. One region, one provider is fine; the lexical-fallback path handles outages adequately.
- Switching to Modal, Baseten, or a self-hosted GPU pod. QMD's `RemoteLLM` is OpenAI-compatible at the wire, so migration is a contained config change.
- Streaming responses. Not relevant for embed/rerank/expand; would matter if generative workloads land here.

### Done when

- A full hybrid search via the Spine API returns in under 2 seconds end-to-end on warm workers, 5–8 seconds on cold start.
- The Spine is configured against a running Ollama-on-RunPod endpoint and serving real traffic.
- The fork of QMD with #629 + Kaspre's fixes is published somewhere we control and pinned in `spine/package.json`.
- Lexical-only fallback works — verified once by deliberately pointing the Spine at a dead URL and confirming the surface returns BM25 results with the degraded indicator.
- Weekly cost report is reading correctly and the monthly RunPod bill for QMD-only workload is below $20.

---

## Phase 7 — Annotations and diagram authoring

**Goal**: The surface stops being read-only.

### Scope

**Annotations**:

- New schema:
  ```sql
  CREATE TABLE annotations (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    target_kind TEXT NOT NULL,        -- 'capture', 'local_file', 'working', 'archive'
    target_id TEXT NOT NULL,
    selection_start INTEGER,
    selection_end INTEGER,
    selection_text TEXT,              -- denormalized for display when target changes
    comment TEXT NOT NULL,
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL
  );
  ```
- Annotations apply uniformly across content types — captures, local files, working docs, and archived web pages. The schema accommodates `archive` as a target_kind from the start.
- API routes: `POST /api/annotations`, `GET /api/annotations?target=...`, `DELETE /api/annotations/:id`.
- Surface: highlight any text → comment popup → save. Annotations render inline (highlight + marginal note).
- Annotations are indexed by QMD alongside source content, so searching for what you wrote in an annotation finds the original doc. With Phase 6 in place, new annotation embeddings flow through the Ollama endpoint via QMD's `RemoteLLM` — no special handling, same code path as everything else.

**Diagram authoring (Mermaid only for this phase)**:

- Mermaid blocks in markdown render to SVG live.
- Embedded Mermaid editor: in any working doc, "insert diagram" creates a fenced ` ```mermaid ` block with an inline preview pane.
- Diagrams are just text — no special storage. Searchable by their source content.

### Deferred

- Freeform canvas (tldraw / Excalidraw). Decide after Mermaid is in use; embed-the-React-island is the known fallback.
- Image annotation, OCR for raster images.

### Done when

You can highlight a passage in any doc type, comment on it, find your comment via search later. You can create a Mermaid diagram in a working doc and have it render inline.

---

## Phase 8 — Resurfacing and clustering

**Goal**: The system gets a "what's on my mind" surface.

### Scope

- Wire existing clustering / resurfacing logic into the spine (sidecar process or scheduled job). Embedding-based clustering issues a batch of embedding requests through QMD → Ollama; nightly batch jobs are exactly the workload RunPod serverless is best at (scale to zero between runs, FlashBoot for the warm-up).
- Nightly resurfacing pass writes to:
  ```sql
  CREATE TABLE surfaced (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    target_kind TEXT NOT NULL,
    target_id TEXT NOT NULL,
    surfaced_at TEXT NOT NULL,
    reason TEXT,                      -- 'recency', 'cluster-centroid', 'stale-but-relevant', etc.
    dismissed_at TEXT
  );
  ```
- Surface: a quiet panel on landing showing today's surfaced items. Visible on arrival, invisible once you're inside a doc. Action row uses the positive-dismissal component from Phase 5.
- No streaks, no unread counters, no guilt. Dismissed surfacings cost nothing.

### Cluster-as-view

- `/cluster/:id` shows a cluster's contents as a browseable list.
- "Show cluster" affordance on any doc opens its cluster.

### Deferred

- LLM-classifier-mediated promotion of stale working docs (Phase 9+).
- Task routing via classifier (Phase 9+).

### Done when

You arrive at the surface in the morning, see what was surfaced, and engage with it (or not) without it feeling like a notification feed.

---

## Phase 9+ — Driven by real friction

After Phase 8, next moves depend entirely on what continued use reveals. The Ollama-on-RunPod inference layer from Phase 6 is the deployment substrate for additional models; adding a new workload is "pull a model in Ollama and add env vars to the Spine," not "build a new infrastructure path." Each candidate below is tagged with where it would run.

- **Classifier-driven task routing** *(hosted API — Haiku/Sonnet)*. Captures with explicit dates pipe to the task channel automatically. Classifier as routing layer, not categorization. Generic LLM quality is plenty for this; no fine-tuning advantage to capture. Bakeoff first if a real choice between Haiku and a small classifier emerges.
- **Cron-and-classifier doc promotion** *(hosted API — Claude)*. Stale working docs get summarized by an LLM and presented with a "what is this doc's state?" prompt in the inbox. One-click approve or reject via the positive-dismissal component, no editing. Summarization quality is where frontier models shine; latency is tolerant (results land in inbox).
- **Voice capture transcription** *(Ollama on RunPod, with Whisper)*. Add a Whisper GGUF to the same Ollama instance, expose via the same OpenAI-compatible audio endpoint, route from a new `/api/agent/transcribe` Spine route. Hosted alternative is Groq's Whisper which is fast and cheap — worth a bakeoff if volume gets meaningful.
- **Image annotation / OCR** *(Ollama on RunPod, vision model)*. Pull a vision model into the same Ollama instance. Latency-tolerant. Hosted alternative is MathPix (specialized) or a hosted VLM.
- **Freeform canvas** *(local, no inference)*. tldraw or Excalidraw embed, if Mermaid proves insufficient.
- **Additional indexer agents** *(local)* on other personal machines.
- **Work-machine browser form** *(local)* — minimal capture path for the locked-down environment.
- **On-demand cross-machine file fetch** *(local)* — the surface pulls a remote file's contents from another machine's agent.
- **Per-machine agent tokens** *(local)* — promote from one shared token to a token-per-machine model.
- **Headless browser archival** *(local on spine)* — only if mobile-captured JS sites become frequent enough friction that the ops cost is worth paying.
- **Refined "Where you were" heuristic** *(local)* — current implementation auto-resumes one specific doc; may need to show two or three options if the choice feels arbitrary.
- **Inference provider migration** *(infra)* — if Ollama-on-RunPod becomes painful (cost, reliability, region availability), migrate to Modal, Baseten, or a self-hosted GPU pod. QMD's `RemoteLLM` is OpenAI-compatible at the wire, so this is a config change, not a refactor.
- **vLLM swap** *(infra)* — only if a generative workload (summarization, classification at scale) emerges where Ollama's throughput becomes a bottleneck. Requires verifying non-GGUF availability for the affected models.
- **Community release prep** *(meta)* — documentation, ADHD-friendly onboarding, configurable language. Possibly far out, but worth carrying as a quiet design constraint: avoid wording that implies performance metrics or guilt mechanics ("Process 10 in 5 min" → "Quick batch" is the kind of softening that matters for a wider audience).

Do not plan these specifically before real use prioritizes them.

---

## Cross-cutting concerns

These aren't phases — they're things to keep right throughout.

### Backups

The spine is a single point of failure for everything you care about. SQLite backup script running daily to off-VPS storage from day one. Test the restore path before relying on it; otherwise backups are theatre.

The `archives` table adds a wrinkle: the archived HTML files in `/var/lib/lattice/web/` are separate from the SQLite DB. Backups must include both. If backing up the DB without the files (or vice versa), restores produce broken references.

The Ollama-on-RunPod inference layer holds no state worth backing up — models are pulled from HuggingFace via Ollama's registry, and the cache regenerates on demand. The recoverable artifacts are the RunPod endpoint configuration (env vars, network volume settings) and the QMD fork's git history. Keep both in version control / config-as-code so a clean rebuild is possible.

### Migrations

When schemas change, write a numbered migration SQL file in `spine/migrations/`. Apply on startup. Don't `ALTER TABLE` by hand. The migrations directory is the source of truth for the schema.

### Template-tweak discipline

The "don't redesign templates" rule applies recursively to the system itself. You will be tempted to redesign the schema, switch frameworks, restructure the API, switch inference providers. Each is the meta-version of the template-tweak trap. Build forward; refactor only when use demands it.

This is also why Phase 6 adopts upstream work (PR #629 + Kaspre's fixes) rather than building bespoke remote-inference code. The temptation to do it "right" yourself is the same temptation as redesigning the schema.

### One environment

You're the only user. Dev environment is prod environment. Don't set up staging. Backups cover the disaster case.

Mild exception for the Ollama endpoint: it's worth running a local Ollama instance during dev work that touches the QMD config plumbing, so changes can be exercised without paying for RunPod cold starts. Not a staging environment — just a faster feedback loop.

### Idempotency at boundaries

Agents and capture clients will re-send the same payload under various conditions. The spine should dedupe on natural keys (`(machine_id, path, hash)` for files, URL + content hash for archives) and treat re-sends as no-ops. Design this in; retrofitting is painful.

For archives specifically: if the same URL is captured twice via the same path (e.g., two SingleFile captures from different sessions), treat them as separate archives — they may legitimately differ (different login state, different time, different consent banners). Supersession is only for cross-path re-capture (degraded monolith → good SingleFile).

For inference: query embedding and document embedding use different prompt templates and must stay distinguished (QMD's `RemoteLLM` handles this via the `format` flag QMD already plumbs through). QMD's existing `llm_cache` table handles request-level idempotency within QMD; the Ollama endpoint is stateless beyond model loading.

### HTTPS only

Spine refuses non-HTTPS requests. Caddy handles TLS; the spine fails closed if it ever sees a non-HTTPS request. Spine → RunPod is over HTTPS (RunPod terminates TLS at the endpoint URL).

### The inference layer: where does each workload run?

A recurring design question once Phase 6 is in place. The default answer: **use whatever the rest of the inference layer uses unless there's a specific reason not to**. Concretely, this means Ollama-on-RunPod by default; deviate only when:

- **Use a hosted LLM API (Claude, OpenAI) instead** when:
  - The workload needs frontier model quality (summarization, complex reasoning, multi-step agents).
  - Generic LLM quality is sufficient and there's no fine-tuned model to preserve.
  - Latency is tight enough that even Ollama cold-starts hurt and the workload doesn't justify keeping a warm worker (hosted APIs have effectively zero cold start).

- **Stay local on the Spine (no inference at all)** when:
  - The work isn't actually ML (most things).
  - The work is so trivial it doesn't need it (string matching, glob lookups, simple stats).

- **Build a custom inference container** when:
  - A required model isn't supported by Ollama or any other OpenAI-compatible server, and is important enough to justify the maintenance.
  - This is rare. Don't reach for it unless you've actually tried Ollama and hit a real wall.

The default-of-Ollama matters because each deviation adds operational surface area. A new hosted API is a new bill, a new outage mode, a new auth boundary. Sometimes that's worth it; usually it isn't.

### Cost ceilings and escalation

The Ollama-on-RunPod stack is cheap until it isn't. Reasonable expectations:

- **Phase 6 baseline**: $10–20/month for QMD-only workload at one-user volume. Alert in RunPod console at 2× expected ($40).
- **Phase 7–8 baseline**: another $5–15/month as annotation indexing + nightly clustering run. Alert ceiling: $60 total.
- **Phase 9+ baseline**: each new workload adds maybe $5–20/month depending on usage. Total realistic ceiling for one user: $50–100/month.

Triggers to rethink the architecture (not in order of severity, but each is a real signal):

- **$100+/month consistently** → consider a dedicated GPU pod (RTX 4090 hourly on RunPod is ~$0.30–0.40, so ~$220–300/month for 24/7). Breaks even somewhere around 3–4× current usage. Trade scale-to-zero for predictability.
- **Cold-start latency feels actively bad more than once a week** → bump minimum workers from 0 to 1 (effectively keep-warm). Costs more but adds reliability to the hot path.
- **A single hosted-API workload (Claude summarization, etc.) consistently exceeds $30/month** → bakeoff against a self-hosted alternative on the existing Ollama instance.
- **A single workload's RunPod bill is more than 5× any other workload's** → time to ask whether it's correctly sized (wrong GPU class, no batching, etc.) or whether it belongs on a different substrate (hosted API, dedicated pod).

The point of these triggers is to make the rethinking moment explicit rather than letting it drift. Don't migrate before a trigger fires; do migrate within a week of one firing if it stays fired.

### External dependencies

After Phase 6, Lattice has runtime dependencies beyond the VPS: RunPod (hosts inference), and from Phase 9+ likely also Anthropic/OpenAI (hosted LLM APIs for select workloads). New operational concerns:

- **Cost visibility**: weekly cost report from the `lattice cost` command, billing alerts in each provider's console. Looking at bills once a month is not enough feedback when adding multiple providers.
- **Vendor portability**: QMD's `RemoteLLM` is OpenAI-compatible at the wire. Migrating from RunPod to Modal/Baseten/a self-hosted pod is a URL change. Don't tie hard to provider-specific features when standard alternatives exist.
- **Outage resilience**: QMD's `HybridLLM` already degrades gracefully to lexical-only when remote inference is unreachable. Verify quarterly that the fallback works — flip the inference URL to an invalid one for a minute and confirm search still returns BM25 results with the degraded indicator.
- **Multi-provider auth surface**: each external dependency adds a token to rotate. Document the rotation cadence (annual default, immediate on suspected compromise) and store tokens in the Spine's `.env` only — never in git, never in the QMD fork.
- **Provider sprawl prevention**: every new hosted API is a new operational surface. The default of "use the existing Ollama instance" exists in part to avoid adding providers casually. New provider = new bill + new auth + new outage mode + new monitoring.

### The system can detect, the user decides

A recurring design principle worth keeping visible: **the system can detect, flag, and route, but the final editorial call always belongs to the user.** Especially for inclusion in the permanent record. A flag is information; an action is yours. This applies to:

- Technical-quality classification on archives (system flags `degraded`, user decides re-capture vs. delete).
- Recently-captured review (system surfaces, user keeps or archives).
- Future classifier-driven workflows (system routes a candidate, user confirms or rejects).
- Future LLM-generated summaries on stale working docs (system drafts, user approves or rejects).
- Degraded-search fallback indicator (system reports it's serving lexical-only, user decides whether to retry or proceed).

The cost of the system being subtly wrong silently is much higher than the cost of one extra click per item. Build accordingly.

### Notification discipline

Two related rules:

1. **Ephemeral notifications are an ADHD anti-pattern for actionable items.** A toast that disappears before action is taken is a leak. Use ephemeral surfaces only for confirmations of completed actions (e.g., "captured" after a successful submit), never for pending state.
2. **Pending-action state lives in the surface, not in the notification channel.** Signal relay tells you something needs attention; the surface holds what specifically and lets you act on it. Closing the surface does not clear pending state — positive dismissal is the only way out.

---

## Definition of "done" for the whole project

There isn't one. Lattice is a system you'll use indefinitely and evolve. The thing being built is a working substrate — a place where capture is reflexive, retrieval is trustworthy, and the surface supports actual thinking. Phase 8 is roughly where it crosses from "interesting experiment" to "the place my thinking lives." Everything after is refinement against real use.

The thing to most avoid: over-building any phase before living with the previous one. The friction surfaces faster than design can predict. Phase 6 is itself proof of this — it was a Phase 9+ deferred item until usage forced it forward, and its scope shrank by an order of magnitude when prior art (PR #629) turned out to already exist.
