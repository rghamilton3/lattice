# Tasks: Feature 022 - API Key/Token and Remote Endpoint Management

<!-- Tech Stack Validation: PASSED -->
<!-- Validated against: .specswarm/tech-stack.md -->
<!-- No prohibited technologies found -->

## Completion Tracker

- [X] T001 Install QMD 2.5.3 from vendored tarball — spine/
- [X] T002 Verify @tobilu/qmd deep imports compile under spine tsconfig — spine/src/
- [X] T003 [P] Create migration 019_settings.sql (inference_config + agent_tokens tables) — spine/migrations/019_settings.sql
- [X] T004 [P] Add InferenceConfigRow and AgentTokenRow types to db/rows.ts — spine/src/db/rows.ts
- [X] T005 Create settings.ts module (merged config read, live agent token, applyInferenceSettings) — spine/src/settings.ts
- [X] T006 [P] Update guards.ts: agentToken fixed string → getAgentToken getter function — spine/src/guards.ts
- [X] T007 [P] Update app.ts and server entry to wire getActiveAgentToken into agent guard — spine/src/app.ts
- [X] T008 [US1,US5,P] Add GET /api/settings/inference route (returns merged config, has_key booleans, no key values) — spine/src/routes/settings.ts
- [X] T009 [US1,US2,US5,P] Add PUT /api/settings/inference route (UPSERT DB overrides, URL validation, 422 on bad URL, calls applyInferenceSettings) — spine/src/routes/settings.ts
- [X] T010 Register settingsRoutes in the Authentik-guarded block — spine/src/app.ts
- [X] T011 [US3,P] Extend GET /api/status response with inference_endpoints array (role, url, status, last_ok_at) — spine/src/routes/status.ts
- [X] T012 [US3,P] Add POST /api/settings/inference/probe route (parallel per-role connectivity check, 5s AbortController timeout) — spine/src/routes/settings.ts
- [X] T013 [US3,P] Extend StatusResponse type with inference_endpoints field — surface/src/lib/api/status.ts
- [X] T014 [US4,P] Add GET /api/settings/security route (has_agent_token, agent_token_source) — spine/src/routes/settings.ts
- [X] T015 [US4,P] Add POST /api/settings/security/rotate-agent-token route (32-byte hex, DB transaction, setActiveAgentToken) — spine/src/routes/settings.ts
- [X] T016 [US4,P] Add PUT /api/settings/security route (custom token, min 16 chars, 422 on short) — spine/src/routes/settings.ts
- [X] T017 Create surface/src/lib/api/settings.ts (typed fetch wrappers for all settings endpoints + TanStack Query keys) — surface/src/lib/api/settings.ts
- [X] T018 [P] Create InferenceSettings.svelte (per-role URL/model/key fields, masked key indicator, Rotate key input, Save with inline feedback, Test connectivity badges) — surface/src/components/overlays/InferenceSettings.svelte
- [X] T019 [P] Create SecuritySettings.svelte (token source badge, Rotate token with read-once display + copy button, Set custom token form) — surface/src/components/overlays/SecuritySettings.svelte
- [X] T020 Modify Settings.svelte: add Display/Inference/Security tab strip, wire InferenceSettings and SecuritySettings panels — surface/src/components/overlays/Settings.svelte
- [X] T021 [US3] Add per-role inference endpoint health badges (ok/degraded/unconfigured) to the Status view — surface/src/components/
- [X] T022 Write spine settings route unit tests (CRUD, validation, token rotation, guard hot-swap) — spine/src/routes/settings.test.ts
- [X] T023 [P] Update existing agent guard tests to use getAgentToken getter signature — spine/src/routes/agent.ts (tests)

---

## User Stories

| ID | Story | Scenarios | Priority |
|----|-------|-----------|----------|
| US1 | Configure inference endpoint from UI | Scenario 1, Scenario 5 | P1 |
| US2 | Rotate an API key | Scenario 2 | P1 |
| US3 | View endpoint health | Scenario 3 | P2 |
| US4 | Rotate the agent token | Scenario 4 | P2 |
| US5 | Clear an endpoint | Scenario 5 | P1 |

---

## Phase 1: Prerequisites

**Goal**: QMD 2.5.3 is installed and deep imports are confirmed working.

### T001 - Install QMD 2.5.3

Run `bun install` in `spine/` to install from `vendor/tobilu-qmd-2.5.3.tgz`. Confirm:
- `node_modules/@tobilu/qmd/package.json` shows `"version": "2.5.3"`
- `node_modules/@tobilu/qmd/dist/remote-llm.d.ts` exists
- `node_modules/@tobilu/qmd/dist/llm.d.ts` contains `setDefaultLLM`

### T002 - Verify deep imports compile

After T001, create a minimal probe in `spine/src/_probe.ts` (delete after):
```typescript
import { setDefaultLLM } from '@tobilu/qmd/dist/llm.js';
import { RemoteLLM } from '@tobilu/qmd/dist/remote-llm.js';
void setDefaultLLM; void RemoteLLM;
```
Run `bun run check`. If it fails with "cannot find module" errors, add `paths` entries in
`spine/tsconfig.json` or create a re-export shim at `spine/src/qmd-llm.ts` and use that
throughout the feature instead of direct deep imports.

---

## Phase 2: Database Schema

**Goal**: Migration 019 applied, row types available. Parallelizable pair.

### T003 [P] - Migration 019_settings.sql

Create `spine/migrations/019_settings.sql`:

```sql
CREATE TABLE inference_config (
    role       TEXT PRIMARY KEY CHECK(role IN ('embed', 'rerank', 'expand', 'asr')),
    api_url    TEXT,
    model      TEXT,
    api_key    TEXT,
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

Spine applies migrations in filename order at startup (`spine/src/db.ts`). Verify the
file sorts after `018_audio_transcription.sql`.

### T004 [P] - Row types

Append to `spine/src/db/rows.ts`:

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
    active: number; // SQLite boolean: 1 = true, 0 = false
}
```

---

## Phase 3: Foundational - Settings Module

**Goal**: Core settings layer in place. All later phases depend on T005.

### T005 - Create spine/src/settings.ts

This module is the single source of truth for runtime settings. It must:

1. **Read merged inference config** (DB > config.toml > env):

```typescript
import type { Database } from 'bun:sqlite';
import type { InferenceConfigRow } from './db/rows';
import { getQmdModelsConfig, getAgentToken as getConfigAgentToken } from './config';

export type InferenceRole = 'embed' | 'rerank' | 'expand' | 'asr';

export interface InferenceRoleSettings {
    api_url: string | undefined;
    model: string | undefined;
    has_key: boolean;
    source: 'database' | 'config' | 'env' | 'none';
}

export interface InferenceSettings {
    embed:  InferenceRoleSettings;
    rerank: InferenceRoleSettings;
    expand: InferenceRoleSettings;
    asr:    InferenceRoleSettings;
}

export function getInferenceSettings(db: Database): InferenceSettings { ... }
```

2. **Live agent token** (module-level var, updated on rotation):

```typescript
let _activeAgentToken: string | undefined;

export function initActiveAgentToken(db: Database): void {
    // Check DB first, then fall back to config/env
    const row = db.query('SELECT token FROM agent_tokens WHERE active = 1 LIMIT 1').get() as { token: string } | null;
    _activeAgentToken = row?.token ?? getConfigAgentToken();
}

export function setActiveAgentToken(token: string): void { _activeAgentToken = token; }
export function getActiveAgentToken(): string | undefined { return _activeAgentToken; }
export function getAgentTokenSource(db: Database): 'database' | 'config' | 'env' | 'none' { ... }
```

3. **QMD hot-reconfigure**:

```typescript
// Import from deep path (or shim if T002 required one)
import { setDefaultLLM } from '@tobilu/qmd/dist/llm.js';
import { RemoteLLM, type RemoteLLMConfig } from '@tobilu/qmd/dist/remote-llm.js';

export function applyInferenceSettings(db: Database): void {
    const s = getInferenceSettings(db);
    if (!s.embed.api_url || !s.embed.model) {
        setDefaultLLM(null);
        return;
    }
    const cfg: RemoteLLMConfig = {
        embedApiUrl:   s.embed.api_url,
        embedApiModel: s.embed.model,
        ...(s.rerank.api_url ? { rerankApiUrl: s.rerank.api_url, rerankApiModel: s.rerank.model } : {}),
        ...(s.expand.api_url ? { expandApiUrl: s.expand.api_url, expandApiModel: s.expand.model } : {}),
    };
    // Retrieve actual key values from DB for the config object (not exposed in API responses)
    const rows = db.query('SELECT role, api_key FROM inference_config').all() as Pick<InferenceConfigRow, 'role' | 'api_key'>[];
    const keyMap = Object.fromEntries(rows.map(r => [r.role, r.api_key]));
    if (keyMap.embed) cfg.embedApiKey = keyMap.embed;
    if (keyMap.rerank) cfg.rerankApiKey = keyMap.rerank;
    if (keyMap.expand) cfg.expandApiKey = keyMap.expand;
    setDefaultLLM(new RemoteLLM(cfg));
}
```

4. Call `initActiveAgentToken(db)` and `applyInferenceSettings(db)` in the spine startup
   sequence (wherever `initSearch` is called, in `index.ts` or the equivalent entry point).
   Read it and add the two calls after the DB is opened and migrations applied.

### T006 [P] - Update guards.ts

Change `AgentGuardOptions`:

```typescript
export interface AgentGuardOptions {
    allowHttp: boolean;
    getAgentToken: () => string | undefined;  // was: agentToken: string | undefined
}

export function agentBeforeHandle({ allowHttp, getAgentToken }: AgentGuardOptions) {
    return ({ headers, set }: BeforeHandleCtx): string | undefined => {
        if (!allowHttp && headers['x-forwarded-proto'] !== 'https') {
            set.status = 400;
            return 'HTTPS required';
        }
        const authHeader = headers['authorization'] ?? '';
        const token = authHeader.startsWith('Bearer ') ? authHeader.slice(7) : '';
        const agentToken = getAgentToken();
        if (!agentToken || !token || !tokenMatches(token, agentToken)) {
            set.status = 401;
            return 'Unauthorized';
        }
        return undefined;
    };
}
```

### T007 [P] - Wire getter in app.ts

In `buildApp()`, change:
```typescript
// Before
app.guard({ beforeHandle: agentBeforeHandle({ allowHttp, agentToken }) }, ...)

// After
import { getActiveAgentToken } from './settings';
app.guard({ beforeHandle: agentBeforeHandle({ allowHttp, getAgentToken: getActiveAgentToken }) }, ...)
```

Remove `agentToken` from `AppDeps` if it is no longer used elsewhere. Also update
`buildPlatformStatus` (in `status.ts`) - it currently takes `agentToken: string | undefined`
for the configuration check; change it to call `getActiveAgentToken()` directly or accept
a getter, whichever is simpler.

---

## Phase 4: User Stories 1, 2, 5 - Inference Endpoint CRUD

**Goal**: Users can configure, update, rotate keys on, and clear inference endpoints.
T008 and T009 are parallelizable (different logical sections of the same new file).

### T008 [US1,US5,P] - GET /api/settings/inference

Create `spine/src/routes/settings.ts` with this route:

```typescript
import { Elysia } from 'elysia';
import type { Database } from 'bun:sqlite';
import { getInferenceSettings } from '../settings';

export const settingsRoutes = (db: Database) =>
    new Elysia()
        .get('/api/settings/inference', () => getInferenceSettings(db))
        ...
```

Response shape matches `InferenceSettings` - all fields present, `has_key` boolean, no key values.

### T009 [US1,US2,US5,P] - PUT /api/settings/inference

Add to `spine/src/routes/settings.ts`:

Body schema (all optional; `null` or `""` clears):
```typescript
{
    embed?:  { api_url?: string | null; model?: string | null; api_key?: string | null };
    rerank?: { api_url?: string | null; model?: string | null; api_key?: string | null };
    expand?: { api_url?: string | null; model?: string | null; api_key?: string | null };
    asr?:    { model?: string | null; api_key?: string | null };
}
```

Logic:
1. Validate URL fields: if non-null and non-empty must match `/^https?:\/\//`. On failure
   return 422 `{ errors: { 'embed.api_url': 'Must be a valid HTTP/HTTPS URL' } }`.
2. For each provided role, UPSERT into `inference_config`:
   ```sql
   INSERT INTO inference_config (role, api_url, model, api_key, updated_at)
   VALUES (?, ?, ?, ?, strftime('%Y-%m-%dT%H:%M:%SZ','now'))
   ON CONFLICT(role) DO UPDATE SET
     api_url    = COALESCE(excluded.api_url,    api_url),
     model      = COALESCE(excluded.model,      model),
     api_key    = COALESCE(excluded.api_key,    api_key),
     updated_at = excluded.updated_at
   ```
   When a field is explicitly `null`/`""`: set the column to NULL (clear override).
3. Call `applyInferenceSettings(db)`.
4. Return `204 No Content`.

### T010 - Register settingsRoutes in app.ts

In `buildApp`, inside the Authentik guard block, add:
```typescript
import { settingsRoutes } from './routes/settings';
// ...
.use(settingsRoutes(db))
```

---

## Phase 5: User Story 3 - Endpoint Health

**Goal**: Users can see per-role endpoint status in the Status view; on-demand probe available.
T011, T012, T013 are independent work in different files.

### T011 [US3,P] - Extend /api/status with inference_endpoints

In `spine/src/routes/status.ts`, add to the GET handler return value:

```typescript
import { getInferenceSettings } from '../settings';
import { isSearchDegraded } from '../search';

// Inside the handler:
const inferenceSettings = getInferenceSettings(db);
const roles = ['embed', 'rerank', 'expand', 'asr'] as const;
const inference_endpoints = roles
    .filter(role => inferenceSettings[role].api_url !== undefined)
    .map(role => ({
        role,
        url: inferenceSettings[role].api_url,
        status: role === 'embed' && isSearchDegraded() ? 'degraded' : 'ok',
        last_ok_at: null as string | null,
    }));
// Also include unconfigured roles
const all_endpoints = roles.map(role => ({
    role,
    url: inferenceSettings[role].api_url,
    status: inferenceSettings[role].api_url === undefined
        ? 'unconfigured'
        : role === 'embed' && isSearchDegraded() ? 'degraded' : 'ok',
    last_ok_at: null as string | null,
}));

return { ...existingFields, inference_endpoints: all_endpoints };
```

### T012 [US3,P] - POST /api/settings/inference/probe

Add to `spine/src/routes/settings.ts`:

```typescript
.post('/api/settings/inference/probe', async () => {
    const settings = getInferenceSettings(db);
    const roles = ['embed', 'rerank', 'expand'] as const;
    const results = await Promise.all(
        roles.map(async (role) => {
            const url = settings[role].api_url;
            if (!url) return [role, null] as const;
            const start = performance.now();
            const controller = new AbortController();
            const timer = setTimeout(() => controller.abort(), 5_000);
            try {
                await fetch(`${url}/models`, { signal: controller.signal });
                return [role, { reachable: true, latency_ms: Math.round(performance.now() - start) }] as const;
            } catch (e) {
                const error = controller.signal.aborted ? 'timeout' : String(e);
                return [role, { reachable: false, latency_ms: Math.round(performance.now() - start), error }] as const;
            } finally {
                clearTimeout(timer);
            }
        })
    );
    return Object.fromEntries(results.filter(([, v]) => v !== null));
})
```

### T013 [US3,P] - Extend StatusResponse type in surface

In `surface/src/lib/api/status.ts`, add:

```typescript
export interface InferenceEndpointStatus {
    role: 'embed' | 'rerank' | 'expand' | 'asr';
    url: string | undefined;
    status: 'ok' | 'degraded' | 'unconfigured';
    last_ok_at: string | null;
}

// Add to StatusResponse:
inference_endpoints: InferenceEndpointStatus[];
```

---

## Phase 6: User Story 4 - Agent Token Management

**Goal**: Users can view token source, rotate, and set a custom agent token.
T014, T015, T016 are parallelizable (all add to the same settings route file but touch different endpoints).

### T014 [US4,P] - GET /api/settings/security

Add to `spine/src/routes/settings.ts`:

```typescript
import { getActiveAgentToken, getAgentTokenSource } from '../settings';

.get('/api/settings/security', () => ({
    has_agent_token: Boolean(getActiveAgentToken()),
    agent_token_source: getAgentTokenSource(db),
}))
```

`getAgentTokenSource` checks: DB active row exists → `'database'`; else config.toml has value → `'config'`; else env has value → `'env'`; else `'none'`.

### T015 [US4,P] - POST /api/settings/security/rotate-agent-token

Add to `spine/src/routes/settings.ts`:

```typescript
import { randomBytes } from 'node:crypto';
import { setActiveAgentToken } from '../settings';

.post('/api/settings/security/rotate-agent-token', () => {
    const newToken = randomBytes(32).toString('hex'); // 64 hex chars
    db.transaction(() => {
        db.run('UPDATE agent_tokens SET active = 0');
        db.run(
            'INSERT INTO agent_tokens (token, active) VALUES (?, 1)',
            [newToken]
        );
    })();
    setActiveAgentToken(newToken);
    return { token: newToken };
})
```

### T016 [US4,P] - PUT /api/settings/security (custom token)

Add to `spine/src/routes/settings.ts`:

```typescript
.put('/api/settings/security', ({ body, set }) => {
    const { agent_token } = body as { agent_token: string };
    if (!agent_token || agent_token.length < 16) {
        set.status = 422;
        return { errors: { agent_token: 'Must be at least 16 characters' } };
    }
    db.transaction(() => {
        db.run('UPDATE agent_tokens SET active = 0');
        db.run('INSERT INTO agent_tokens (token, active) VALUES (?, 1)', [agent_token]);
    })();
    setActiveAgentToken(agent_token);
    set.status = 204;
})
```

---

## Phase 7: Surface - API Client

**Goal**: Typed wrappers for all settings endpoints.

### T017 - Create surface/src/lib/api/settings.ts

```typescript
import { apiFetch } from './client';

export interface InferenceRoleResponse {
    api_url?: string;
    model?: string;
    has_key: boolean;
    source: 'database' | 'config' | 'env' | 'none';
}
export interface InferenceSettingsResponse {
    embed: InferenceRoleResponse;
    rerank: InferenceRoleResponse;
    expand: InferenceRoleResponse;
    asr: InferenceRoleResponse;
}
export type InferenceRole = 'embed' | 'rerank' | 'expand' | 'asr';
export interface InferenceRoleUpdate {
    api_url?: string | null;
    model?: string | null;
    api_key?: string | null;
}
export interface InferenceUpdateBody {
    embed?: InferenceRoleUpdate;
    rerank?: InferenceRoleUpdate;
    expand?: InferenceRoleUpdate;
    asr?: Omit<InferenceRoleUpdate, 'api_url'>;
}
export interface ProbeResult { reachable: boolean; latency_ms: number; error?: string; }
export interface ProbeResponse { embed?: ProbeResult; rerank?: ProbeResult; expand?: ProbeResult; }
export interface SecurityResponse { has_agent_token: boolean; agent_token_source: string; }

export const settingsKeys = {
    inference: () => ['settings', 'inference'] as const,
    security:  () => ['settings', 'security'] as const,
};

export function fetchInferenceSettings(): Promise<InferenceSettingsResponse> {
    return apiFetch<InferenceSettingsResponse>('/api/settings/inference');
}
export function updateInferenceSettings(body: InferenceUpdateBody): Promise<void> {
    return apiFetch<void>('/api/settings/inference', { method: 'PUT', body: JSON.stringify(body) });
}
export function probeInferenceEndpoints(): Promise<ProbeResponse> {
    return apiFetch<ProbeResponse>('/api/settings/inference/probe', { method: 'POST' });
}
export function fetchSecuritySettings(): Promise<SecurityResponse> {
    return apiFetch<SecurityResponse>('/api/settings/security');
}
export function rotateAgentToken(): Promise<{ token: string }> {
    return apiFetch<{ token: string }>('/api/settings/security/rotate-agent-token', { method: 'POST' });
}
export function setAgentToken(token: string): Promise<void> {
    return apiFetch<void>('/api/settings/security', { method: 'PUT', body: JSON.stringify({ agent_token: token }) });
}
```

---

## Phase 8: Surface - Settings UI

**Goal**: Settings drawer has Inference and Security tabs. T018 and T019 are parallelizable.

### T018 [P] - Create InferenceSettings.svelte

Create `surface/src/components/overlays/InferenceSettings.svelte`. It must:

1. Query `fetchInferenceSettings()` via `createQuery(settingsKeys.inference(), fetchInferenceSettings)`.
2. Render a form section for each role (embed, rerank, expand, asr) with:
   - URL text input (disabled for asr which has no URL)
   - Model text input
   - Key indicator: if `has_key` show `●●●●●●` + "Rotate key" button that toggles a text input
   - "Clear" button that calls `updateInferenceSettings` with `null` for all fields of that role
3. "Save" button calls `updateInferenceSettings(formState)`. On success, show inline
   "Saved" text for 2 seconds (use `$state` + `setTimeout`). On 422, show field-level errors
   next to each input using the `errors` object from the response body.
4. "Test connectivity" button calls `probeInferenceEndpoints()`, then renders per-role badges:
   - Green "OK (Xms)" when `reachable: true`
   - Red "Unreachable: <error>" when `reachable: false`
   - Shows a loading spinner while probe is in-flight

### T019 [P] - Create SecuritySettings.svelte

Create `surface/src/components/overlays/SecuritySettings.svelte`. It must:

1. Query `fetchSecuritySettings()` via `createQuery(settingsKeys.security(), fetchSecuritySettings)`.
2. Show a read-only badge: "Token source: database / config / env / none".
3. "Rotate token" button:
   - Calls `rotateAgentToken()`.
   - On success, displays a `<textarea readonly>` with the new token + a copy-to-clipboard button.
   - Shows warning: "Copy this token now. It will not be shown again."
   - "Done" button dismisses the token display.
4. "Set custom token" toggle reveals a password input + confirm button that calls `setAgentToken()`.
   On 422 shows error below the input.

### T020 - Modify Settings.svelte: tab navigation

In `surface/src/components/overlays/Settings.svelte`:

1. Add `let activeTab: 'display' | 'inference' | 'security' = $state('display')`.
2. Add a tab strip above `settings-body`:
   ```html
   <div class="tab-strip" role="tablist">
     <button role="tab" aria-selected={activeTab === 'display'} onclick={() => activeTab = 'display'}>Display</button>
     <button role="tab" aria-selected={activeTab === 'inference'} onclick={() => activeTab = 'inference'}>Inference</button>
     <button role="tab" aria-selected={activeTab === 'security'} onclick={() => activeTab = 'security'}>Security</button>
   </div>
   ```
3. Wrap existing sections in `{#if activeTab === 'display'}`.
4. Add:
   ```svelte
   {#if activeTab === 'inference'}
     <InferenceSettings />
   {:else if activeTab === 'security'}
     <SecuritySettings />
   {/if}
   ```
5. Import `InferenceSettings` and `SecuritySettings`.

---

## Phase 9: Surface - Status Health Badges

**Goal**: Status view shows per-role endpoint health.

### T021 [US3] - Inference health badges in Status view

First, locate the status view component that renders the existing `/api/status` data.
Search for the component that calls `fetchStatus()` or renders `search_degraded`.
Likely candidates: `surface/src/components/shell/AppShell.svelte` or a dedicated status panel.

Add a new section (after agents list or alongside `search_degraded` indicator):
```svelte
{#if status.inference_endpoints}
  <div class="inference-endpoints">
    {#each status.inference_endpoints as ep (ep.role)}
      <div class="endpoint-badge">
        <span class="dot" class:ok={ep.status === 'ok'} class:degraded={ep.status === 'degraded'} class:unconfigured={ep.status === 'unconfigured'}></span>
        <span class="role">{ep.role}</span>
        {#if ep.url}<span class="url faint">{ep.url}</span>{/if}
        {#if ep.status === 'degraded'}<span class="badge badge-warn">Degraded</span>{/if}
        {#if ep.status === 'unconfigured'}<span class="faint">Not configured</span>{/if}
      </div>
    {/each}
  </div>
{/if}
```

---

## Phase 10: Tests

**Goal**: Spec compliance verified for all settings routes and guard change.

### T022 - Spine settings route tests

Create `spine/src/routes/settings.test.ts`. Test suite:

1. **GET /api/settings/inference** - returns all four roles; `has_key: false` when no key stored.
2. **GET /api/settings/inference** - returns `has_key: true` for a role that has a key in DB.
3. **PUT /api/settings/inference** - valid body returns 204 and row is in DB.
4. **PUT /api/settings/inference** - `api_url: null` clears DB override, subsequent GET shows `api_url: undefined`.
5. **PUT /api/settings/inference** - invalid URL returns 422 with field error.
6. **POST /api/settings/inference/probe** - unconfigured roles absent from response.
7. **POST /api/settings/security/rotate-agent-token** - returns 64-char hex token.
8. **POST /api/settings/security/rotate-agent-token** - old token now rejected by agent guard (test via `agentBeforeHandle` directly with old vs new token).
9. **GET /api/settings/security** - `agent_token_source` is `'database'` after rotation.
10. **PUT /api/settings/security** - token < 16 chars returns 422.
11. **PUT /api/settings/security** - valid custom token accepted; subsequent guard check passes.

Use the existing spine test helpers (in-memory SQLite DB, apply migrations).

### T023 [P] - Update agent guard tests

Find the existing test file(s) that construct `agentBeforeHandle`. Update all call sites:
```typescript
// Before
agentBeforeHandle({ allowHttp: true, agentToken: 'secret' })

// After
agentBeforeHandle({ allowHttp: true, getAgentToken: () => 'secret' })
```

Run `bun test` to confirm no regressions.

---

## Dependency Graph

```
T001 → T002
T003 ─┐
T004 ─┤→ T005 → T006 → T007
                ↓
         T008 ─┐
         T009 ─┤→ T010
         T011 ─┘
         T012
         T014 ─┐
         T015 ─┤→ T017 → T018 ─┐
         T016 ─┘        T019 ─┤→ T020
                                └─→ T021
                         T013
         T022 (after T008-T016)
         T023 (after T006)
```

T003/T004 are parallel. T006/T007 are parallel (both depend on T005). T008/T009 are
parallel (both add to new settings.ts). T011/T012/T013/T014/T015/T016 are all parallel
after T005 and T010. T018/T019 are parallel.

## Parallel Execution Opportunities

**Round 1** (no deps): T001
**Round 2** (after T001): T002
**Round 3** (after T002): T003, T004 in parallel
**Round 4** (after T003+T004): T005
**Round 5** (after T005): T006, T007 in parallel
**Round 6** (after T005+T010 available): T008, T009 in parallel; then T010
**Round 7** (after T010+T005): T011, T012, T013, T014, T015, T016 in parallel; T022 after this round; T023 after T006
**Round 8** (after T017 from previous round): T018, T019 in parallel
**Round 9** (after T018+T019): T020
**Round 10** (after T017+T011): T021

## MVP Scope

**Minimum for US1 (configure inference endpoint from UI):**
T001 → T002 → T003 → T004 → T005 → T006 → T007 → T008 → T009 → T010 → T017 → T018 → T020

This delivers: install QMD 2.5.3, DB schema, settings module, inference GET/PUT routes,
surface API client, Inference tab in Settings drawer.
