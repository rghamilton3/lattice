# Research: Capture Inbox

## Decision: Use Authentik-Protected Spine Capture Routes

Create and read browser captures under `/api/captures`, protected by the existing Authentik header guard used for non-agent routes.

**Rationale**: The constitution requires Authentik header auth for non-agent `/api/*` routes. Capture text is private personal data and must fail closed when the trusted header is missing.

**Alternatives considered**: A public unauthenticated capture endpoint was rejected because it can expose or inject private data. Reusing `/api/agent/capture` was rejected because agent routes use bearer-token auth and a different trust model.

## Decision: Store Captures In SQLite With The Existing Migration Model

Persist captures in the local SQLite database with identity, text, source, captured time, and ingested time managed by spine.

**Rationale**: SQLite via `bun:sqlite` is the approved local-first store, and numbered SQL migrations are the canonical schema definition.

**Alternatives considered**: File-only captures were rejected because inbox listing and ordering need structured queries. An ORM was rejected by the constitution.

## Decision: Enforce A 10,000-Character Text Limit

Reject quick captures longer than 10,000 characters and preserve the draft in the UI for retry or editing.

**Rationale**: The clarification answer sets a concrete validation boundary that supports substantial pasted notes while preventing accidental document-sized submissions.

**Alternatives considered**: 2,000 characters was too restrictive for pasted notes. 50,000 characters and no fixed limit were rejected because they blur capture versus document scope and weaken validation.

## Decision: Use Server-Sent Events For Same-Instance Live Updates

Expose a capture event stream that announces newly created captures to open inbox views in the same spine process.

**Rationale**: SSE is sufficient for one self-hosted instance, works over the existing HTTP boundary, and avoids introducing WebSocket infrastructure or a shared message bus.

**Alternatives considered**: Polling was simpler but less responsive. WebSockets were rejected as extra protocol complexity. Redis or another bus was rejected because horizontal multi-process live updates are outside the single-instance scope.

## Decision: Keep Later Workflow Behavior Out Of Capture Inbox

Limit this feature to creating, listing, and announcing captures. Triage, tasks, attachments, search indexing, and working-doc promotion remain owned by later features unless already present and unavoidable.

**Rationale**: The queue separates these capabilities into later features. Keeping the capture inbox narrow reduces rework and respects component and feature boundaries.

**Alternatives considered**: Building triage or task creation into the capture feature was rejected because it expands scope and crosses into queued features.

## Decision: Record Accessibility Evidence For Browser Workflow Changes

Update `docs/accessibility/capture-inbox.md` with keyboard, focus, dialog, state text, and non-color-only checks.

**Rationale**: The feature affects interactive browser UI, so WCAG 2.2 AA governance applies and evidence should be captured.

**Alternatives considered**: Skipping accessibility evidence was rejected because this is no longer backend-only infrastructure.
