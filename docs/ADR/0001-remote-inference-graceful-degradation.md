# ADR-0001: QMD neural inference runs as a remote, swappable dependency with graceful degradation

- Status: Accepted
- Date: 2026-06-03

## Context

QMD's quality pipeline — vector embedding, LLM reranking, and query expansion — is GPU-class work. On the spine's CPU it bottlenecks immediately: the full-quality ("deep") search path has never been observed below roughly 80% CPU, and node-llama-cpp serialises inference through a single context, so concurrent work queues and times out. The original fast/deep split existed only to keep that cost off the interactive path. Full-quality search needs a GPU.

QMD PR #705 (HybridLLM + RemoteLLM) provides the mechanism: an OpenAI-compatible remote backend where embed, rerank, and expand can each be routed to a remote endpoint independently, with per-endpoint circuit breakers and a startup pre-flight embed probe. It is opt-in — unconfigured, the local path is unchanged.

The inference server is a separate link from the spine. This is true of the current homelab box (anecdotally reliable, but the weakest link in the system), and it stays true of any alternative — a serverless GPU, a cloud API, a second home machine. A remote GPU service is a single point of failure wherever it runs; only its failure *shape* differs (hard outage vs. cold-start latency vs. rate limits). So graceful degradation is not a homelab workaround — it is a property of treating inference as a remote dependency at all. The provider is therefore an implementation detail behind a fixed contract, not an architectural commitment.

## Decision

Route QMD's embed, rerank, and expand operations to a remote OpenAI-compatible endpoint via #705's HybridLLM. The provider sits behind that contract and is swappable by config.

Full-quality search is the default and the only mode. The user-facing fast/deep toggle is removed.

Degradation is split by path:

- **Read path.** When the endpoint's breaker is healthy, search runs the full pipeline. When it trips, search degrades to keyword-only (BM25 + best-effort local query embedding), dropping rerank and expansion entirely, with a quiet degraded indicator on the surface. It does **not** fall back to running rerank/expansion on the CPU — that is the bottleneck being escaped, so #705's built-in local fallback for those operations is deliberately not relied upon for them.
- **Write path.** Index-time embedding routes remote like the rest, but runs as a durable, retryable job. When the endpoint is down, new content is indexed lexically and is keyword-searchable immediately; its vector embedding backfills on recovery. An outage delays vector coverage; it never silently produces a document with no vector.

Detection uses #705's per-endpoint circuit breakers and startup probe as the signal; the surface reads breaker state to choose mode and render the indicator. Breaker timeout is tuned per provider (short for a hard-down homelab box; tolerant of cold-start latency for a serverless GPU) — a knob, not a redesign.

## Consequences

- Full-quality search becomes the normal case; the speed knob disappears as a concept.
- Search availability is decoupled from inference availability — the system stays useful (keyword-only) through an outage, and write traffic is never lost to one.
- The returned result set varies with inference uptime. For a single user this is acceptable because the degraded indicator makes a thinner result set read as "inference is offline," not "search broke." The indicator's name (e.g. "Keyword-only") is a surface detail, not part of this decision.
- VRAM/capacity becomes a real planning input, not a deferred note: embed, rerank, and expand models, plus future feature models (OCR, description VLM, classifier), contend for the same card. "Capacity exists, it gets filled" applies; a resident-set and spillover plan belong in the inference-layer phase.
- New neural features attach as additional endpoints under the same contract and inherit the same degradation rules, rather than each inventing its own infra path.
- Index-time embedding gains a durable-status/queue mechanism — the same shape as the attachment `extraction_status` work, reused rather than reinvented.

## Alternatives considered

- **Spine-local CPU inference.** Rejected: it is the bottleneck this decision exists to remove; #705 itself characterises CPU embedding of the small models as unacceptably slow.
- **Local CPU fallback for rerank/expansion** (HybridLLM's built-in behaviour). Rejected for those operations: it turns every inference hiccup into the slow path on the interactive route, which is worse than the pre-GPU opt-in it would replace.
- **Spine-local embedding kept on the write path** for outage independence. Rejected in favour of remote + durable queue: keeping embedding on the CPU reintroduces the write-side bottleneck, and the durable queue already provides outage-safety without it.

## Correction (2026-06-08)

Two phrases above describe the decision inaccurately. Per the append-only convention they are corrected here rather than rewritten in place, since the decision itself never changed (the rest of this ADR, and `specs/016-remote-inference`, already describe the implemented behavior).

- **Read path is strictly BM25, with no local query embedding.** The Decision says "keyword-only (BM25 + best-effort local query embedding)". There is no local query embedding: the deployment is remote-only, and a query embedded by any non-remote model matches zero stored vectors (QMD filters by `model`/`embed_fingerprint`). The fallback is `store.searchLex()` only — consistent with the "does not fall back to running rerank/expansion on the CPU" sentence in the same section and with the rejected "Local CPU fallback" alternative.
- **Degraded detection infers breaker state; the surface does not read it.** The Detection paragraph says "the surface reads breaker state to choose mode and render the indicator". QMD's circuit breakers are `private`, so spine infers degradation by catching the failure thrown from `store.search()` and falling back to BM25, then reports a per-response `degraded` flag (and the last-known state on `/api/status`). The surface renders the indicator from that flag, not from breaker state.
