---
parent_branch: main
feature_number: "022"
status: In Progress
created_at: 2026-06-13T23:19:10-05:00
---

# Feature 022: API Key/Token and Remote Endpoint Management

## Overview

Lattice's remote inference configuration (embedding, reranking, query expansion, and ASR endpoints)
is currently only configurable via `~/.config/lattice/config.toml` or environment variables —
requiring SSH access and a text editor to change. This feature adds a spine REST API and a Surface UI
panel that lets the user view and update remote inference endpoint URLs, model names, and API keys,
as well as view and rotate the agent bearer token, all from within the browser without touching
config files.

The agent token (`LATTICE_AGENT_TOKEN`) is also surfaced for rotation. New values persist in a
dedicated database table so they survive spine restarts independently of the static config file.
Database values take precedence over config.toml values, which in turn take precedence over env vars
(consistent with the existing layering in `spine/src/config.ts`).

API key values are write-only in API responses — the UI can set or rotate keys but never retrieves
plaintext after initial storage.

## User Scenarios

**Scenario 1 — Configure a new inference endpoint**
The user has set up a GPU server running llama.cpp. They open the Settings panel in Surface,
navigate to "Inference Endpoints", enter the URL and model for embedding, and click Save. Spine
immediately applies the new config without restarting. Search quality improves from BM25-only to
full vector search.

**Scenario 2 — Rotate an API key**
The user's inference provider issues a new API key. They open Settings → Inference Endpoints,
click "Rotate key" for the embedding endpoint, enter the new key, and confirm. The old key is
replaced in the database; the next search call uses the new credential.

**Scenario 3 — View endpoint health**
The user opens the Status section and sees which inference endpoints are reachable (green) vs.
degraded (amber). Each endpoint row shows the last successful call timestamp and the current
circuit-breaker state, so they can diagnose connectivity issues without checking spine logs.

**Scenario 4 — Rotate the agent token**
The user suspects a stale agent on a decommissioned machine is still using the old token. They
open Settings → Security, click "Rotate agent token", copy the new token, and update it on their
active agents. Old-token requests are immediately rejected.

**Scenario 5 — Clear an endpoint**
The user no longer has a reranking service. They open Settings → Inference Endpoints, clear the
reranking URL, and save. Spine drops the reranker from the QMD pipeline; search continues without
reranking.

## Functional Requirements

### Endpoint Configuration CRUD

1. **View current config** — `GET /api/settings/inference` returns all endpoint URLs and model
   names in effect (merged: database overrides config.toml overrides env vars). API key presence
   is indicated by a boolean `has_key`, never by value.
2. **Update config** — `PUT /api/settings/inference` accepts any subset of URL/model/key fields.
   Fields set to `null` clear the database override (falling back to config.toml / env var).
   Fields set to `""` are treated identically to `null` (clear).
3. **Atomic apply** — after a successful `PUT`, spine reconfigures QMD in-process without restart.
4. **Validation** — URL fields must be valid HTTP/HTTPS URLs; model fields are free-form strings.
   A `PUT` with an invalid URL returns 422 with a field-level error body.

### Agent Token Management

5. **View token presence** — `GET /api/settings/security` returns `{ agent_token_source, has_agent_token }`.
   `agent_token_source` indicates where the active token comes from: `"database"`, `"config"`, or `"env"`.
6. **Rotate agent token** — `POST /api/settings/security/rotate-agent-token` generates a
   cryptographically random 32-byte hex token, stores it in the database, and returns it exactly
   once in the response body. Subsequent reads never return the plaintext.
7. **Custom agent token** — the same `PUT /api/settings/security` endpoint allows setting an
   arbitrary token string (minimum 16 characters). This supports cases where the user has already
   distributed a known token to agents.

### Endpoint Health

8. **Health summary in status** — `GET /api/status` gains an `inference_endpoints` field: an array
   of `{ role, url, status, last_ok_at }` records (one per configured role: embed, rerank, expand,
   asr). `status` is `"ok"`, `"degraded"`, or `"unconfigured"`. Existing `search_degraded` flag
   remains unchanged.
9. **Probe on demand** — `POST /api/settings/inference/probe` triggers an immediate connectivity
   check to each configured endpoint and returns `{ [role]: { reachable, latency_ms, error? } }`.

### Surface UI

10. **Settings panel — Inference tab** — the existing Settings drawer gains an "Inference" tab
    (visible only when the user has admin-equivalent access, which for single-user Lattice means any
    authenticated user). It presents a form with fields for each endpoint URL + model pair, a
    masked key indicator, and a "Rotate key" action per slot.
11. **Settings panel — Security tab** — shows `agent_token_source` and a "Rotate token" button
    that calls the rotate endpoint, then copies the new token to clipboard and prompts the user to
    update their agent config.
12. **Live status badges** — the Status view (already accessed via the command palette) shows
    per-role endpoint health badges derived from `inference_endpoints` in the status response.
13. **Save feedback** — the inference form shows inline success/error feedback after save, with
    field-level error messages for validation failures.

## Success Criteria

1. A user can update an inference endpoint URL from the Surface UI and have search quality change
   within the same browser session, without editing any config file or restarting spine.
2. After rotating the agent token via the UI, existing agent connections using the old token return
   401 within one polling cycle.
3. API key values entered via the UI are never returned in any API response (confirmed by
   inspecting network traffic in the browser developer tools).
4. The inference tab loads and displays current endpoint configuration in under 2 seconds on a
   local network.
5. Clearing all inference endpoints via the UI returns search to BM25-only mode (same behavior as
   when no `[spine.qmd]` section exists in config.toml).
6. The probe endpoint returns a result for each configured role within 10 seconds (timeout per
   endpoint is 5 seconds).

## Key Entities

**inference_config** (new DB table)
- `role` — `embed | rerank | expand | asr` (primary key)
- `api_url` — nullable string
- `model` — nullable string
- `api_key` — nullable string (stored as-is; not hashed, not encrypted — matches existing agent_token pattern)
- `updated_at` — ISO timestamp

**agent_tokens** (new DB table)
- `id` — autoincrement
- `token` — 64-char hex string
- `created_at` — ISO timestamp
- `active` — boolean (only one row is active at a time)

## Assumptions

- Single-user deployment: any Authentik-authenticated user is considered admin. No RBAC layer is
  needed for this feature.
- API keys are stored in plaintext in SQLite (consistent with the existing `agent_token` pattern
  in config.toml). Encryption at rest is out of scope.
- QMD exposes `setDefaultLLM` (alongside the existing `setDefaultLlamaCpp`) in the widened LLM
  interface from PR #705. Spine calls `setDefaultLLM` with a freshly-constructed remote LLM
  instance after persisting new settings — no store teardown or spine restart required.
- The Surface settings drawer is the correct UX home for this feature; a separate settings page is
  not needed.
- The agent token rotation does not automatically push the new token to running agents —
  out-of-band update (user copies and reconfigures agents) is acceptable.
- Endpoint URLs in `[spine.qmd]` config do not include auth headers beyond a single Bearer token;
  more complex auth schemes are out of scope.

## Scope

### Included
- New spine DB schema: `inference_config` and `agent_tokens` tables.
- New spine REST endpoints: `GET/PUT /api/settings/inference`, `POST /api/settings/inference/probe`,
  `GET /api/settings/security`, `POST /api/settings/security/rotate-agent-token`.
- Extension to `/api/status` with `inference_endpoints` health field.
- In-process QMD reconfiguration after settings change.
- Surface Settings drawer: Inference and Security tabs.
- Surface Status view: per-role endpoint health badges.
- Spine unit tests for settings CRUD and token rotation.

### Explicitly Excluded
- Encryption of stored API keys.
- Multi-user / role-based access to settings.
- Automatic propagation of new agent token to running agent processes.
- Management of the Authentik configuration or Caddy TLS settings.
- Audit log of settings changes.
- Import/export of configuration as a file.
