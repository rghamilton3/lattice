# Lattice: Findings

Knowledge extraction from the retired Lattice repo, for Altair. Mined from git history,
tuned constants, abandoned code, explanatory comments, tests, and doc drift.

**Meta-caveat that shapes everything below:** the repo is **squash-merged**. Per-file
evolution is largely erased — most source files (`spine/src/*`, the whole `agent/` tree,
`plan.md`, the constitution) trace to a single mislabeled mega-commit `087ecd6` ("Use
schtasks for Windows installer logon tasks (#78)"). So "changed N times" is often
unknowable, and several bugs survive only as comments describing a diff that no longer
exists. Where a claim says "introduced once, never re-tuned," read it as "no *surviving*
change history" — the tuning may have happened pre-squash.

---

## What worked

- **Graceful degradation as an architectural property, not a homelab patch** (`docs/ADR/0001`).
  Remote inference (embed/rerank/expand) behind a fixed OpenAI-compatible contract, with the
  read path degrading to BM25-keyword-only and the write path indexing lexically-now /
  embedding-later via a durable retry queue. A capture made during an outage is keyword-findable
  immediately and gains vectors on recovery; an outage "never silently produces a document with
  no vector." Locked by `spine/src/search.test.ts` ("write path: index lexically when embedding
  fails, then backfill on recovery").
- **Inferring degradation by catching thrown errors** (`spine/src/search.ts:171-180`). QMD's
  circuit-breaker state is `private`, so spine sets a `_degraded` flag from any failed/successful
  inference call and biases it "stale-true (safe)." A no-inference pass must not clear it. Ugly
  but correct, and the ADR's own Correction (below) validates it.
- **Polling scanner over filesystem watchers** (`agent/`, `specs/008/research.md:5-9`). Native
  notifications "rejected for v1 because cross-platform behavior and missed-event recovery would
  add complexity." Result: no `watch.rs`, no `notify` crate ever added-then-removed, no watcher
  churn. Simplicity held for the whole life of the repo.
- **Subprocess extraction dispatch over libraries** (`agent/src/extract.rs:59-74`, `spine/src/extract.ts`).
  `pandoc`/`pdftotext` as external binaries behind one dispatch table, deliberately mirrored
  between the Rust agent and the TS spine (spec 019 "parity"). Extends the existing poppler
  precedent instead of pulling in doc-parsing libraries.
- **Status-driven idempotent job queue** (`spine/src/extraction-queue.ts:51-55`). Outstanding
  work is defined by the persisted `extraction_status` column, never the in-memory queue:
  `pending`, crash-interrupted `processing`, and transient-`failed` rows all re-enqueue. One
  unified job abstraction reused across archive-url / extract-attachment / ocr / index-embedding
  (`docs/ADR/0001` backlog) rather than per-feature queues.
- **Positive-dismissal + notification-posture pattern** carried coherently from the Phase-4 plan
  through Signal replies, transcription events, and archive events (`quiet`/`standard`/`active`,
  `signal-relay.ts:43-60`, `transcriptionEvents.ts:17-26`). "Every verb is an intent; no X/close."
- **ADRs as a discipline.** `docs/ADR/0001` carries an append-only **Correction (2026-06-08)**
  that admits two statements were wrong *without rewriting them*. The trail caught real drift the
  squashed git history could not.

---

## What did not work

- **Spine-local CPU inference** — the original architecture, abandoned. QMD's full hybrid
  ("deep") search "has never been observed below roughly 80% CPU, and node-llama-cpp serialises
  inference through a single context, so concurrent work queues and times out" (`ADR-0001`);
  >60s per query (`docs/lattice-development-plan.md` Phase 6). Forced the entire remote-inference
  pivot (`9d18aef` → `9097919`, Jun 7–8). The user-facing **fast/deep toggle** — itself a
  workaround "built to avoid the QMD path entirely" — was then *removed*; full-quality became the
  only mode.
- **The reconnect socket leak that "took out the VPS."** `signal-relay.ts:72-76` (verbatim):
  the `connectError` callback *and* the outer `Bun.connect().catch()` each scheduled a retry,
  "doubling parallel connects per failure until ephemeral ports were exhausted." Fixed with a
  single-timer state-machine invariant (`at most one of {activeSocket, connecting, reconnectTimer}`).
  **The buggy diff exists nowhere** — squash erased it; the comment is the only record.
- **Legacy `.doc` extraction via pandoc** — added and reverted **17 minutes later**
  (`2a98dee` → `330152d`). "pandoc has no doc reader, so the mapping failed on every attempt."
  Now takes the UTF-8 fallback; binary `.doc` "skipped visibly, once" (`extract.rs:55-58`).
- **Editor autosave clobbering in-progress text and resetting the cursor** (in vim, to line 1) —
  fought repeatedly. Remount fix (`959f6b2` #84) → full Obsidian-live-preview rewrite
  (`3a2c4b2` #101, +814 lines) introducing `docSync.ts`/`shouldAdoptServerContent` and
  `refetchOnWindowFocus:false`. `EditorPane.svelte` churned 11×, `docSync.ts:1-13` documents the
  whole class of bug.
- **`qwen3-4b` query expansion silently emitting nothing** (`dd552da`). Qwen3 with `--jinja`
  enables thinking by default; the expand call spent its `max_tokens:600` on a `<think>` trace
  before any `lex:`/`vec:`/`hyde:` lines, so QMD parsed zero variants and expansion "silently
  falls back to local/BM25 on every query." Fixed with `--reasoning-budget 0`.
- **Windows tray clicks not delivered** by `tray-icon`'s built-in message pump (`c7cb4e9` #90).
  Needed a direct Win32 `PeekMessageW`/`Translate`/`Dispatch` loop + the `windows-sys` crate — the
  one dependency ever added post-init.
- **Toasts clobbering each other** — background SSE toasts overwrote interactive/navigational
  toasts, fixed twice in one PR (`70d1ae4` #135), then a plain-foreground toast still got clobbered
  → added a `background` discriminator to the `Toast` type.
- **Tab tabbing out of CodeMirror** instead of indenting (`7456acb`, bugfix-003) — missing
  `indentWithTab` from the keymap; browser default took over.
- **The e2e suite as a churn sink** (`surface/e2e/surface.e2e.ts`, 15× — most-churned file in the
  repo). Almost entirely Playwright strict-locator ambiguity, route-registration order
  (last-registered-wins, `1f56fe8`), and the PWA-install notice overlay intercepting clicks
  (`c85cef2`) — not feature work.

---

## Tuned values and what they cost to find

**Recorded reason exists:**

| Value | Location | Reason (recorded) |
|---|---|---|
| ASR timeout `300s` | `spine/src/config.ts:87-91` | "Audio is minutes long and llama-swap may cold-start the ASR shim" — 10× the 30s OCR/VLM timeout |
| Backfill backoff `30s → ×2 → 10min` | `search.ts:186-187,591` | Locked by test `search.test.ts` "doubles … and caps at the maximum" (exact ladder 30/60/120…/600s) |
| Resurface interval `22–26h` jitter | `resurface.ts:12` | "spread load on server restart"; ±2h so the daily pass never pins to a clock minute (`specs/018/plan.md:101`) |
| Resurface skip `7 days` | `cluster.ts:277` | "avoid showing the same item repeatedly" (`specs/018/spec.md:152`) |
| `--reasoning-budget 0` on expand | `dd552da` | stops Qwen3 `<think>` from eating the token budget (above) |
| Drop `--flash-attn` on bge encoders | `dd552da` | bge-m3 / bge-reranker are XLM-RoBERTa encoders whose graph "never builds an FA node, so the flag is a silent no-op" |
| `EXTRACTOR_GENERATION` (cache-bust) | `agent/src/extract.rs:12` | bump to force re-extraction; comment warns to bump on extractor change |

**No recorded reason** (write as "value, no recorded reason"):

- Retrieval top-k `limit: 20` everywhere (`search.ts:805,820,864`) — unchanged across the
  local→remote pivot. BM25 snippet fallback `body.slice(0,200)` (`search.ts:826`). Error-log
  throttle `% 10` (`search.ts:523`).
- Clustering: `k = min(max(round(√n), 2), 20)` (`cluster.ts:181`); k-means `100`-iteration cap
  (`cluster.ts:114`). *(inferred: √n is the standard rule-of-thumb; floor 2 matches the `<2` early
  return; cap 20 bounds resurfacing volume — none of this is written down.)*
- Tracks scoring: exact-token `+2`, substring `+1` (`tracks.ts:83,87`); top-k `50`/`12`/`5`
  (`tracks.ts:112,277,251`).
- Editor: autosave debounce `1500ms` (`EditorPane.svelte:140`); toast `2600ms` plain /
  `5000ms` interactive (`workbench.svelte.ts:366`, only reason given: "clickable toasts stay
  longer"); TOC debounce `300ms`.
- Extraction caps: `MAX_TEXT_CHARS = 100_000` (both `extract.ts:51` and `extract.rs:15`);
  OCR `max_tokens: 2000`, VLM `max_tokens: 500` (2–3 sentences).

**Actually observed changing:**

- `DUPLICATE_HORIZON_MS = 90d` (`tracks.ts:25`) — the horizon *filter* was added in `2d6ab5f`
  ("Filter duplicate hints to tracks within DUPLICATE_HORIZON_MS"); before that, `duplicateHints`
  had no lookback bound.
- `asr_model` example `parakeet-tdt-0.6b-v2 → v3` (`dd552da`).
- Model lineup wholesale (see drift below) — but the *reason* per swap is unrecorded.

**Cost-to-find note:** nearly every constant "was introduced once and never re-tuned" in
surviving history. Given the squash-merge, this is as consistent with "tuned hard in a branch
then squashed" as with "picked once by reasoning." The repo cannot distinguish the two — which is
itself the finding.

---

## Things that surprised me

- **The bakeoff that justified keeping the fine-tuned model, then apparently ignored.** Claude
  Haiku vs the fine-tuned expansion model: "0 Haiku wins, 5 fine-tuned wins, 3 ties across 8 real
  queries, with only 20% result overlap" (`docs/lattice-development-plan.md` Phase 6). The plan's
  conclusion: the fine-tuned `qmd-query-expansion-1.7b` "needs to stay." Yet `config.toml.example`
  ships `expand_api_model = qwen3-4b` — a generic chat model. (Top question below.)
- **No lexical-embedding fallback is even possible.** ADR-0001's original Decision claimed the
  read path degrades to "BM25 + best-effort local query embedding." The **Correction (2026-06-08)**
  retracts it: "a query embedded by any non-remote model matches zero stored vectors (QMD filters
  by `model`/`embed_fingerprint`)." Degraded = strictly `store.searchLex()`.
- **Rerankers emit log-odds, not scores.** llama.cpp `/v1/rerank` returns ~-10..+10; QMD's blend
  and `--min-score 0.3` default "exclude everything otherwise." Kaspre's fix A: `σ(x)` sigmoid
  normalization (`docs/lattice-development-plan.md` Phase 6, fix A).
- **The silent-wrong-model failure mode.** Kaspre's fix C is a 1-token startup embed probe to
  prevent "silent fallback embedded weeks of content with wrong model."
- **`--flash-attn` is a silent no-op on encoder models** (XLM-RoBERTa never builds an FA node) —
  looked like it was doing something for who knows how long (`dd552da`).
- **Text truncation differs between components on non-BMP content**: pandoc/Rust counts Unicode
  scalar values, spine counts UTF-16 code units, so the 100k cut point diverges (`extract.rs:33-36`).
- **SQLite's duplicate-column error is un-typed** — reported as generic `SQLITE_ERROR`; the only
  discriminator is string-matching "duplicate column name," relied on as "stable across SQLite
  versions" (`agent/src/cache.rs:230-243`).
- **The constitution was minted from another project's template.** `.specify/memory/constitution.md`
  v1.0.1 sync report records removing "Stale **Tweeter** constitution content appended after the
  Lattice constitution."
- **Spec numbers collided four times** (011, 012, 014×3, 016) because two roadmaps — the feature
  "phases" and a separate "tracking" physical-inventory sub-product — minted overlapping numbers;
  a migration even had to be renumbered (`b0f1c54` "renumber track_bins migration to 017"). The
  ADR README names this drift explicitly: "the implementation plan has lived in several divergent
  versions with different phase numbers and different inference hardware."

---

## What I would do differently

*(These are inferences from the evidence, not recorded regrets.)*

- **Don't squash-merge a research repo.** The single thing this document most wanted — the
  evolution of churned modules, the diff of the VPS-killing bug — is exactly what squash destroyed.
  Merge commits or rebase-preserve would have kept the learning the ADR README says it wanted.
- **Record constant rationale at the definition site.** The ADR habit worked; extend it to tuned
  values. Most constants (cluster bounds, tracks weights, all the top-ks) have no recorded reason,
  so they can't be safely changed or ported.
- **One plan, one pointer.** `plan.md` (root) and `docs/lattice-development-plan.md` are parallel
  copies of the same "Implementation Plan"; README points at `plan.md`, `CLAUDE.md` points at
  `specs/014-doc-preview-pane/plan.md`. The plan also froze at Phase ~6 while code shipped through
  spec 022.
- **One roadmap / numbering authority.** The 011/012/014/016 collisions and the migration
  renumber were avoidable coordination cost from running two spec streams into one `specs/` space.

---

## Open questions for Altair

*(Design questions the successor must answer, not repo trivia.)*

- **Where does inference live, and what is its failure contract?** ADR-0001's core insight is that
  a remote GPU service is a single point of failure *wherever* it runs — only the failure shape
  differs. Altair should pick the degradation contract first, provider second.
- **Fine-tuned vs generic expansion.** Is the retrieval-quality delta the bakeoff measured worth
  the ops cost of hosting a fine-tuned model? Lattice concluded yes on paper and shipped no.
- **Is "keyword-only" the right honest-degradation UX**, or should degraded search block/queue?
- **Keep the single unified status-driven job abstraction?** It worked well; it's the reusable
  primitive most worth carrying over.
- **Watcher vs poller at scale.** 15-min polling was fine for one user and one machine; a
  multi-machine or lower-latency Altair may need the watcher complexity Lattice deliberately skipped.
- **Horizontal scale.** `captureEvents.ts:1` pub/sub is process-local ("not cross-process —
  horizontal scaling requires replacing this with a shared bus"). If Altair is ever >1 process,
  this is a rewrite.
- **Does "tracking" (physical-item inventory, "where is the drill?") survive** as a first-class
  Altair feature, or was it a Lattice-only experiment folded in opportunistically?

---

## Questions only Robert can answer

*Ranked. Each is a specific gap the repo raises but cannot close.*

1. **Why was the fine-tuned `qmd-query-expansion-1.7b` dropped for generic `qwen3-4b`**
   (`config.toml.example`), when the Phase-6 bakeoff (0 Haiku / 5 fine-tuned / 3 ties, 20% overlap)
   was the explicit reason to keep it? Did retrieval quality actually hold with qwen3-4b, or was it
   a pragmatic "good enough, one less model to host" call?
2. **Plan said Ollama** (a whole "Why Ollama and not vLLM" section); **repo shipped custom
   llama-swap** (`478adfd` #139). What made Ollama lose — idle model eviction, GGUF handling,
   multi-model routing, the `${env.*}` key expansion?
3. **The QMD PR number changed from #629 to #705.** Plan says cherry-pick PR #629
   (`georgelichen:merge-pr-517-remote-llm`); ADR-0001 and `9d18aef` say PR #705. Did Kaspre push
   their fork, did you re-fork, or did #629 get superseded upstream?
4. **Why the switch to the bge family?** embed `embeddinggemma-300M → bge-m3`, rerank
   `qwen3-reranker-0.6b → bge-reranker-v2-m3` (plan vs `config.toml.example`). Quality, licensing,
   or just what llama-swap served cleanly?
5. **Auth: Authelia or Authentik?** `plan.md` / dev plan say "Caddy + **Authelia** forward auth";
   the constitution (Principle IV, tech-stack table) says **Authentik**. Which shipped, and why the
   switch?
6. **Was the reconnect socket leak** (`signal-relay.ts:72-76`) **actually hit on the live VPS**, and
   how long between "VPS is down" and finding the double-scheduled retry? (The diff is gone; only
   your memory has the incident.)
7. **`cluster.ts` k = √n bounded [2,20], 100-iteration cap** — chosen by experiment on your real
   corpus, or reasonable defaults never revisited?
8. **Was removing the fast/deep search toggle** (ADR-0001) purely because remote inference made
   full-quality fast enough, or had you already stopped using "fast" in practice?
9. **`tracks.ts` scoring (+2 exact / +1 substring) and top-k (50/12/5)** — tuned against real
   "where's the drill" queries, or first-guess values?
10. **Were the feature "phases" and the "tracking" sub-product genuinely developed in parallel**
    (hence the 011/012/016 spec collisions and the `b0f1c54` migration renumber), and did that
    collision cause real merge pain — or was it just cosmetic?
11. **Why `parakeet-tdt-0.6b` for ASR** (bumped v2→v3 in `dd552da`) rather than Whisper, which the
    plan named for Phase 9+ voice? And why the `v2→v3` bump — a bug, or just currency?
12. **The `EXTRACTOR_GENERATION = 1` never bumped** despite the `.doc` removal and the extract
    refactors — did no shipped extractor change actually invalidate cached extractions, or was the
    bump forgotten?
