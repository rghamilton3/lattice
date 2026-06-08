# Architecture Decision Records

Lightweight, append-only records of decisions that shape Lattice. One file per decision.

Once a record is **Accepted**, it is not rewritten. If a later decision changes it, write a new ADR that supersedes it and change the old one's Status line to `Superseded by ADR-NNNN`. The trail is the point — you should be able to read why a thing is the way it is, including the parts that later turned out wrong.

Why these exist: Lattice is a research project, and the line between *research* (a tracked decision with recorded reasoning you can revisit) and *experiment* (a choice made in passing that you half-remember in three weeks) is whether the reasoning survives the conversation it happened in. ADRs are that survival. They are cheap insurance against the drift this plan has already shown — the implementation plan has lived in several divergent versions with different phase numbers and different inference hardware, none of them recording *why* anything moved.

Naming: `NNNN-short-kebab-title.md`, zero-padded, sequential.

## Template

```
# ADR-NNNN: <title>

- Status: Proposed | Accepted | Superseded by ADR-NNNN
- Date: YYYY-MM-DD

## Context
The forces in play — constraints, observations, the problem. What's true that makes this a decision.

## Decision
What we're doing, stated plainly.

## Consequences
What this makes true, good and bad. What it forecloses.

## Alternatives considered
What else was on the table and why it lost.
```

## Scope

ADRs capture *decisions*. Feature-level designs live as their own design docs (e.g. the attachment-extraction doc) and link back to the ADRs that bind them. No PRDs — single user, no stakeholders to align, so a requirements document would be ceremony.

## Backlog (decisions made but not yet recorded)

These were settled in design discussion and should be backfilled as ADRs:

- In-process job queue + subprocessing, rather than a separate extraction worker.
- The indexer agent owns Tier 0 extraction (extract locally, post text).
- All content ingestion routes through the spine; the AI server is an internal compute dependency with no agent-facing surface.
- One unified job abstraction (`archive-url`, `extract-attachment`, `ocr-dispatch`, index-embedding) rather than per-feature queues.
