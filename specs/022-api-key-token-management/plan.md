---
feature: "022"
title: "API Key/Token and Remote Endpoint Management"
parent_branch: main
status: In Progress
---

# Plan: Feature 022 - API Key/Token and Remote Endpoint Management

## Tech Stack Compliance Report

All technologies in this feature are already in the approved stack.

| Technology | Status | Notes |
|------------|--------|-------|
| TypeScript (spine/surface) | Approved | Core stack |
| Elysia route plugin | Approved | Existing pattern |
| bun:sqlite | Approved | All DB access |
| @tobilu/qmd RemoteLLM / setDefaultLLM | Approved | Tarball 2.5.3; node_modules synced |
| SvelteKit / Svelte 5 runes | Approved | Surface UI |
| @tanstack/svelte-query | Approved | API state in surface |

No prohibited technologies. No conflicts. No new entries needed in tech-stack.md.

---

## Constitution Check

| Principle | Assessment |
|-----------|-----------|
| P1 - TypeScript only for web source | All new files under `spine/src` and `surface/src` are `.ts` / `.svelte`. |
| P2 - Normalize before structuredSearch | No new structuredSearch calls in this feature. |
| P3 - Spine binds localhost only | No change to binding; all new routes are added inside the existing Elysia app. |
| P4 - Capture is one motion | Not applicable - settings UI only. |
| P5 - Tests accompany features | Unit tests for settings CRUD and token rotation are included in scope. |
| P6 - No em dashes | Authoring rule; will be observed. |

---

## Technical Context

### Current state

- Inference endpoint config (embed/rerank/expand/asr URLs, model names, API keys) is read at
  spine startup from `~/.config/lattice/config.toml` and env vars via `getQmdModelsConfig()`.
  There is no runtime API to change these values.
- The agent bearer token is similarly read at startup from `config.toml` or
  `LATTICE_AGENT_TOKEN` and passed as a fixed string into `buildApp()` → `agentBeforeHandle()`.
  Rotating it currently requires editing config and restarting spine.
- `@tobilu/qmd` 2.5.3 (tarball) exports `setDefaultLLM(llm: LLM | null)` from
  `@tobilu/qmd/dist/llm.js` and `RemoteLLM` from `@tobilu/qmd/dist/remote-llm.js`.
  The currently installed node_modules is stale (2.5.1); `bun install` in `spine/` is the
  first task.

### Key constraints

- API keys are stored as plaintext in SQLite - same trust model as the existing `agent_token`
  in config.toml. No encryption at rest.
- The agent guard currently captures `agentToken` as a string closure at `buildApp()` time.
  For rotation to take effect without restarting spine, the guard must read from a live
  in-memory value that the settings layer can update.
- `setDefaultLLM` is not exported from `@tobilu/qmd`'s main `index.js` entrypoint; it must be
  imported from `@tobilu/qmd/dist/llm.js` directly. Likewise, `RemoteLLM` comes from
  `@tobilu/qmd/dist/remote-llm.js`. TypeScript may require `moduleResolution: "bundler"` or
  explicit `.js` extension imports - check that spine's `tsconfig.json` permits deep imports.
- The probe endpoint fires HTTP requests to user-supplied URLs. A per-endpoint timeout of 5s
  must be enforced with `AbortController` to prevent slow responses from blocking the handler.

---

## Implementation Phases

---

## Phase 0: Prerequisites

### P0.1 - Install QMD 2.5.3

Run `bun install` in `spine/` to sync node_modules from the tarball. Verify
`node_modules/@tobilu/qmd/package.json` shows `"version": "2.5.3"` and that
`dist/remote-llm.d.ts` and `dist/llm.d.ts` (with `setDefaultLLM`) are present.

### P0.2 - Verify deep imports compile

Write a one-line import probe in a scratch test file and confirm `bun run check` passes:
```typescript
import { setDefaultLLM } from '@tobilu/qmd/dist/llm.js';
import { RemoteLLM } from '@tobilu/qmd/dist/remote-llm.js';
```
If `tsconfig.json` rejects `.js` deep imports, add `@tobilu/qmd/dist/*` to `paths` or
switch the import to a re-export shim at `spine/src/qmd-llm.ts`.

---

## Phase 1: Database Schema

### Migration: `spine/migrations/019_settings.sql`

```sql
CREATE TABLE inference_config (
    role TEXT PRIMARY KEY CHECK(role IN ('embed', 'rerank', 'expand', 'asr')),
    api_url  TEXT,
    model    TEXT,
    api_key  TEXT,
    updated_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%SZ', 'now'))
);

CREATE TABLE agent_tokens (
    id         INTEGER PRIMARY KEY AUTOINCREMENT,
    token      TEXT NOT NULL,
    created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%SZ', 'now')),
    active     INTEGER NOT NULL DEFAULT 1
);
CREATE INDEX idx_agent_tokens_active ON agent_tokens(active);
```

DB row types go in `spine/src/db/rows.ts` (existing file):
```typescript
export interface InferenceConfigRow {
    role: 'embed' | 'rerank' | 'expand' | 'asr';
    api_url: string | null;
    model: string | null;
    api_key: string | null;
    updated_at: string;
}
export interface AgentTokenRow {
    id: number;
    token: string;
    created_at: string;
    active: number;
}
```

---

## Phase 2: Settings Module (`spine/src/settings.ts`)

Central module responsible for:
1. Reading merged config (DB overrides config.toml overrides env vars)
2. Writing DB overrides and calling `setDefaultLLM` atomically
3. Providing the live agent token for the auth guard

### Merged config read

```typescript
export interface InferenceRole {
    api_url: string | undefined;
    model: string | undefined;
    has_key: boolean;
    source: 'database' | 'config' | 'env' | 'none';
}

export interface InferenceSettings {
    embed:  InferenceRole;
    rerank: InferenceRole;
    expand: InferenceRole;
    asr:    InferenceRole;
}

export function getInferenceSettings(db: Database): InferenceSettings { ... }
```

Reading order for each field: DB row first, then `getQmdModelsConfig()` value, then env var.
`has_key` is `true` when an API key is present from any source; key value is never returned.

### Live agent token

```typescript
// In-memory copy updated on rotation; guards read this, not the startup closure.
let _activeAgentToken: string | undefined;

export function setActiveAgentToken(token: string | undefined): void {
    _activeAgentToken = token;
}

export function getActiveAgentToken(): string | undefined {
    return _activeAgentToken;
}
```

`main.ts` (or wherever `buildApp` is called) must call `setActiveAgentToken(getAgentToken())`
at startup with the startup-time token. The agent guard changes from accepting a string to
calling `getActiveAgentToken()` on each request.

### QMD reconfigure

```typescript
import { setDefaultLLM } from '@tobilu/qmd/dist/llm.js';
import { RemoteLLM, type RemoteLLMConfig } from '@tobilu/qmd/dist/remote-llm.js';

export function applyInferenceSettings(db: Database): void {
    const cfg = buildRemoteLLMConfig(db);
    if (cfg) {
        setDefaultLLM(new RemoteLLM(cfg));
    } else {
        setDefaultLLM(null); // fall back to LlamaCpp default
    }
}
```

`buildRemoteLLMConfig` maps the merged inference settings into `RemoteLLMConfig`. If
`embed.api_url` and `embed.model` are both absent (both cleared), returns `null`.

---

## Phase 3: Guards Update (`spine/src/guards.ts`)

Change `AgentGuardOptions.agentToken: string | undefined` to a getter:

```typescript
export interface AgentGuardOptions {
    allowHttp: boolean;
    getAgentToken: () => string | undefined;   // was: agentToken
}

export function agentBeforeHandle({ allowHttp, getAgentToken }: AgentGuardOptions) {
    return ({ headers, set }: BeforeHandleCtx): string | undefined => {
        ...
        const agentToken = getAgentToken();
        if (!agentToken || !token || !tokenMatches(token, agentToken)) { ... }
    };
}
```

`buildApp` passes `getAgentToken: getActiveAgentToken` from `settings.ts`. The
`AgentGuardOptions` type and all tests that construct it must be updated.

---

## Phase 4: Settings Routes (`spine/src/routes/settings.ts`)

All routes live inside the existing Authentik-guarded `app.guard` block in `app.ts`.

### `GET /api/settings/inference`

Returns `InferenceSettings` (see Phase 2). No key values, only `has_key` booleans.

### `PUT /api/settings/inference`

Body (all fields optional; `null` clears the DB override):
```typescript
{
    embed?:  { api_url?: string | null; model?: string | null; api_key?: string | null };
    rerank?: { api_url?: string | null; model?: string | null; api_key?: string | null };
    expand?: { api_url?: string | null; model?: string | null; api_key?: string | null };
    asr?:    { model?: string | null; api_key?: string | null };
}
```

Validation: URL fields must match `^https?://` when non-null/non-empty. Return 422 with
field-level errors on failure. On success: UPSERT rows in `inference_config`, then call
`applyInferenceSettings(db)`. Return `204 No Content`.

### `POST /api/settings/inference/probe`

For each configured role (embed/rerank/expand), fire a lightweight HTTP request to the
endpoint URL (e.g., `GET <url>/models` or `POST <url>/embeddings` with a minimal body).
Enforce a 5s `AbortController` timeout per role. Run roles in parallel via `Promise.all`.
Return:
```typescript
{
    embed?:  { reachable: boolean; latency_ms: number; error?: string };
    rerank?: { reachable: boolean; latency_ms: number; error?: string };
    expand?: { reachable: boolean; latency_ms: number; error?: string };
}
```
Unconfigured roles are omitted from the response.

### `GET /api/settings/security`

Returns:
```typescript
{
    has_agent_token: boolean;
    agent_token_source: 'database' | 'config' | 'env' | 'none';
}
```
Source priority: DB active token > config.toml `agent_token` > `LATTICE_AGENT_TOKEN` env.

### `POST /api/settings/security/rotate-agent-token`

1. Generate 32 random bytes → 64-char hex string via `crypto.randomBytes(32).toString('hex')`.
2. In a transaction: set all existing rows `active = 0`, insert new row with `active = 1`.
3. Call `setActiveAgentToken(newToken)` so the guard picks it up immediately.
4. Return `{ token: newToken }` - the only time the plaintext token is returned.

### `PUT /api/settings/security`

Body: `{ agent_token: string }` (min 16 chars). Same transaction as rotate but with the
user-supplied token instead of a random one.

---

## Phase 5: Status Extension (`spine/src/routes/status.ts`)

Add `inference_endpoints` to the `/api/status` response:

```typescript
inference_endpoints: Array<{
    role: 'embed' | 'rerank' | 'expand' | 'asr';
    url: string | undefined;
    status: 'ok' | 'degraded' | 'unconfigured';
    last_ok_at: string | null;   // ISO timestamp; null if never confirmed ok
}>;
```

`status` is derived from: unconfigured if no URL, degraded if `isSearchDegraded()` is true
and this is the embed role, ok otherwise. `last_ok_at` is not persisted in this feature
(always `null` for now) - that's a future enhancement.

---

## Phase 6: Surface - API Client (`surface/src/lib/api/settings.ts`)

New file with typed fetch wrappers:

```typescript
export interface InferenceRoleResponse { api_url?: string; model?: string; has_key: boolean; }
export interface InferenceSettingsResponse { embed: ...; rerank: ...; expand: ...; asr: ...; }
export interface SecurityResponse { has_agent_token: boolean; agent_token_source: string; }
export interface ProbeResponse { embed?: ProbeResult; rerank?: ProbeResult; expand?: ProbeResult; }

export const settingsKeys = {
    inference: () => ['settings', 'inference'] as const,
    security:  () => ['settings', 'security'] as const,
};

export function fetchInferenceSettings(): Promise<InferenceSettingsResponse> { ... }
export function updateInferenceSettings(body: InferenceUpdateBody): Promise<void> { ... }
export function probeInferenceEndpoints(): Promise<ProbeResponse> { ... }
export function fetchSecuritySettings(): Promise<SecurityResponse> { ... }
export function rotateAgentToken(): Promise<{ token: string }> { ... }
export function setAgentToken(token: string): Promise<void> { ... }
```

Add `inference_endpoints` to the existing `StatusResponse` interface in
`surface/src/lib/api/status.ts`.

---

## Phase 7: Surface - Settings Drawer Tabs

### `surface/src/components/overlays/Settings.svelte`

Add an active-tab state to the existing Settings component:

```svelte
let activeTab: 'display' | 'inference' | 'security' = $state('display');
```

Add a tab strip at the top of `settings-body`:
```
[Display] [Inference] [Security]
```

Wrap existing sections in the `display` panel. Add two new panels:

**Inference panel** (`<InferenceSettings />` sub-component):
- Query loads `fetchInferenceSettings()` via `@tanstack/svelte-query`.
- For each role (embed, rerank, expand, asr): a URL field, a model field, a key indicator
  (`●●●●●●` with a "Rotate key" button that reveals a text input), and a "Clear" button.
- "Save" button calls `updateInferenceSettings()`; on success shows inline "Saved" badge
  for 2s; on 422 shows field-level error messages.
- "Test connectivity" button calls `probeInferenceEndpoints()` and shows per-role
  reachable/latency/error badges inline.

**Security panel** (`<SecuritySettings />` sub-component):
- Shows `agent_token_source` as a read-only badge.
- "Rotate token" button calls `rotateAgentToken()`, then shows the token in a read-once
  text area with a copy-to-clipboard button and a warning: "Copy this token now - it will
  not be shown again."
- "Set custom token" link reveals a text input + confirm button calling `setAgentToken()`.

Both sub-components live in `surface/src/components/overlays/` as separate `.svelte` files.

---

## Phase 8: Surface - Status View Health Badges

The Status view (opened via command palette) already queries `/api/status`. Extend it to
render per-role endpoint health badges from `inference_endpoints`:

- Green dot + role name + URL when `status === 'ok'`
- Amber dot + role name when `status === 'degraded'`
- Grey dot + role name (italic) when `status === 'unconfigured'`

The exact component that renders status info needs to be located (likely in
`surface/src/components/shell/` or a dedicated status component).

---

## Phase 9: Tests

### Spine unit tests (`spine/src/routes/settings.test.ts`)

- `GET /api/settings/inference` returns merged config with `has_key` true when key present
- `PUT /api/settings/inference` with valid data returns 204 and updates DB
- `PUT /api/settings/inference` with invalid URL returns 422 with field error
- `PUT /api/settings/inference` with `null` field clears DB override (falls back to config)
- `POST /api/settings/security/rotate-agent-token` returns 64-char hex token
- Subsequent `GET /api/settings/security` shows `agent_token_source: 'database'`
- `PUT /api/settings/security` with token < 16 chars returns 422
- Agent guard rejects old token immediately after rotation (no restart)

### Guards test update

Update `agentBeforeHandle` tests to pass `getAgentToken: () => token` instead of `agentToken: token`.

---

## Artifact Summary

| Artifact | Action |
|----------|--------|
| `spine/migrations/019_settings.sql` | New |
| `spine/src/db/rows.ts` | Extend (2 new row types) |
| `spine/src/settings.ts` | New |
| `spine/src/guards.ts` | Modify (agentToken → getter) |
| `spine/src/routes/settings.ts` | New |
| `spine/src/routes/status.ts` | Extend (inference_endpoints) |
| `spine/src/app.ts` | Extend (register settingsRoutes) |
| `spine/src/routes/settings.test.ts` | New |
| `surface/src/lib/api/settings.ts` | New |
| `surface/src/lib/api/status.ts` | Extend (inference_endpoints type) |
| `surface/src/components/overlays/Settings.svelte` | Modify (add tabs) |
| `surface/src/components/overlays/InferenceSettings.svelte` | New |
| `surface/src/components/overlays/SecuritySettings.svelte` | New |
| Status view component | Modify (add health badges) |
