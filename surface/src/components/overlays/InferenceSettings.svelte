<script lang="ts">
	import { createQuery, createMutation, useQueryClient } from '@tanstack/svelte-query';
	import { browser } from '$app/environment';
	import {
		settingsKeys,
		fetchInferenceSettings,
		updateInferenceSettings,
		probeInferenceEndpoints,
		fetchInferenceModels,
		type InferenceUpdateBody,
		type ProbeResponse,
		type ProbeRequest,
		type InferenceRole
	} from '$lib/api/settings';

	const qc = useQueryClient();

	const query = createQuery(() => ({
		queryKey: settingsKeys.inference(),
		queryFn: fetchInferenceSettings,
		enabled: browser
	}));

	const roles: { id: InferenceRole; label: string }[] = [
		{ id: 'embed', label: 'Embed' },
		{ id: 'rerank', label: 'Rerank' },
		{ id: 'expand', label: 'Expand' },
		{ id: 'asr', label: 'ASR' },
		{ id: 'vlm', label: 'VLM (vision · OCR)' }
	];

	type RoleForm = { api_url: string; model: string; api_key: string; showKey: boolean };
	const blank = (): RoleForm => ({ api_url: '', model: '', api_key: '', showKey: false });

	let form = $state<Record<InferenceRole, RoleForm>>({
		embed: blank(),
		rerank: blank(),
		expand: blank(),
		asr: blank(),
		vlm: blank()
	});
	let globalForm = $state<{ api_url: string; api_key: string; showKey: boolean }>({
		api_url: '',
		api_key: '',
		showKey: false
	});

	// Snapshot of saved values so we only PUT fields the user actually changed —
	// this keeps inherited (global/file/env) values from being frozen as overrides.
	let initial = $state<Record<InferenceRole, { api_url: string; model: string }>>({
		embed: { api_url: '', model: '' },
		rerank: { api_url: '', model: '' },
		expand: { api_url: '', model: '' },
		asr: { api_url: '', model: '' },
		vlm: { api_url: '', model: '' }
	});
	let initialGlobalUrl = $state('');

	let errors = $state<Record<string, string>>({});
	let saveStatus = $state<'' | 'saving' | 'saved' | 'error'>('');
	let saveTimer: ReturnType<typeof setTimeout> | undefined;

	let probeStatus = $state<'' | 'probing' | 'error'>('');
	let probeResults = $state<ProbeResponse | null>(null);
	let probeRan = $state(false);

	type ModelState = { status: '' | 'loading' | 'error'; list: string[]; error: string };
	const blankModels = (): ModelState => ({ status: '', list: [], error: '' });
	let models = $state<Record<InferenceRole, ModelState>>({
		embed: blankModels(),
		rerank: blankModels(),
		expand: blankModels(),
		asr: blankModels(),
		vlm: blankModels()
	});

	$effect(() => {
		const data = query.data;
		if (!data) return;
		for (const role of roles) {
			const d = data[role.id];
			form[role.id].api_url = d.own_api_url ?? '';
			form[role.id].model = d.model ?? '';
			initial[role.id] = { api_url: d.own_api_url ?? '', model: d.model ?? '' };
		}
		globalForm.api_url = data.global.api_url ?? '';
		initialGlobalUrl = data.global.api_url ?? '';
	});

	const saveMutation = createMutation(() => ({
		mutationFn: (body: InferenceUpdateBody) => updateInferenceSettings(body),
		onSuccess: () => {
			qc.invalidateQueries({ queryKey: settingsKeys.inference() });
			errors = {};
			// Collapse key editors back to their masked/inherited display.
			for (const role of roles) {
				form[role.id].showKey = false;
				form[role.id].api_key = '';
			}
			globalForm.showKey = false;
			globalForm.api_key = '';
			saveStatus = 'saved';
			if (saveTimer) clearTimeout(saveTimer);
			saveTimer = setTimeout(() => {
				saveStatus = '';
			}, 2000);
		},
		onError: async (err: unknown) => {
			saveStatus = 'error';
			if (err && typeof err === 'object' && 'body' in err) {
				try {
					const body = JSON.parse((err as { body: string }).body);
					if (body?.errors) errors = body.errors;
				} catch {
					// ignore parse failure
				}
			}
		}
	}));

	function buildBody(): InferenceUpdateBody {
		const body: InferenceUpdateBody = {};

		// A key is sent whenever the field holds a value (fresh entry or rotation).
		// showKey only governs input visibility, not whether the key is submitted.
		const g: { api_url?: string | null; api_key?: string | null } = {};
		if (globalForm.api_url !== initialGlobalUrl) g.api_url = globalForm.api_url || null;
		if (globalForm.api_key) g.api_key = globalForm.api_key;
		if (Object.keys(g).length > 0) body.global = g;

		for (const role of roles) {
			const f = form[role.id];
			const init = initial[role.id];
			const patch: { api_url?: string | null; model?: string | null; api_key?: string | null } = {};
			if (f.api_url !== init.api_url) patch.api_url = f.api_url || null;
			if (f.model !== init.model) patch.model = f.model || null;
			if (f.api_key) patch.api_key = f.api_key;
			if (Object.keys(patch).length > 0) body[role.id] = patch;
		}
		return body;
	}

	function save() {
		saveStatus = 'saving';
		errors = {};
		saveMutation.mutate(buildBody());
	}

	// Effective URL/key currently shown for a role (possibly unsaved). Empty values
	// let the server fall back to the stored config.
	function formOverride(role: InferenceRole): { url?: string; api_key?: string } {
		const url = form[role].api_url || globalForm.api_url || undefined;
		const api_key = form[role].api_key || globalForm.api_key || undefined;
		return { url, api_key };
	}

	async function probe() {
		probeStatus = 'probing';
		probeResults = null;
		probeRan = false;
		const overrides: ProbeRequest = {};
		for (const role of roles) overrides[role.id] = formOverride(role.id);
		try {
			probeResults = await probeInferenceEndpoints(overrides);
			// Reachable endpoints also report their models — populate the dropdowns.
			for (const role of roles) {
				const r = probeResults[role.id];
				if (r?.reachable && r.models) {
					models[role.id] = { status: '', list: r.models, error: '' };
				}
			}
			probeStatus = '';
			probeRan = true;
		} catch {
			probeStatus = 'error';
		}
	}

	async function loadModels(role: InferenceRole) {
		models[role] = { status: 'loading', list: [], error: '' };
		const { url, api_key } = formOverride(role);
		try {
			const res = await fetchInferenceModels({ role, url, api_key });
			models[role] = { status: '', list: res.models, error: '' };
		} catch (err) {
			let msg = 'request failed';
			if (err && typeof err === 'object' && 'body' in err) {
				try {
					msg = JSON.parse((err as { body: string }).body)?.error ?? msg;
				} catch {
					// ignore parse failure
				}
			}
			models[role] = { status: 'error', list: [], error: msg };
		}
	}
</script>

<div class="inference-settings">
	{#if query.isLoading}
		<p class="faint" style="font-size:13px">Loading...</p>
	{:else if query.isError}
		<p class="faint" style="font-size:13px">Failed to load settings.</p>
	{:else if query.data}
		<section class="settings-section global-section">
			<div class="settings-section-title faint">Global</div>
			<p class="faint" style="font-size:12px; margin:0 0 6px">
				Shared by every endpoint below unless that endpoint sets its own URL or key.
			</p>
			<label class="field-row">
				<span class="field-label faint">URL</span>
				<input
					class="field-input"
					type="url"
					placeholder="https://api.openai.com/v1"
					bind:value={globalForm.api_url}
				/>
			</label>
			{#if errors['global.api_url']}
				<p class="field-error">{errors['global.api_url']}</p>
			{/if}

			<div class="field-row">
				<span class="field-label faint">Key</span>
				{#if query.data.global.has_key && !globalForm.showKey}
					<span class="mono faint" style="font-size:12px">••••••••</span>
					<button
						class="btn btn-ghost"
						style="font-size:12px; padding:2px 6px"
						onclick={() => {
							globalForm.showKey = true;
						}}>Rotate key</button
					>
				{:else}
					<input
						class="field-input"
						type="password"
						placeholder={query.data.global.has_key ? 'new key (leave blank to keep)' : 'API key'}
						bind:value={globalForm.api_key}
					/>
					{#if query.data.global.has_key}
						<button
							class="btn btn-ghost"
							style="font-size:12px; padding:2px 6px"
							onclick={() => {
								globalForm.showKey = false;
								globalForm.api_key = '';
							}}>Cancel</button
						>
					{/if}
				{/if}
			</div>
		</section>

		{#each roles as role (role.id)}
			{@const roleData = query.data[role.id]}
			{@const m = models[role.id]}
			<section class="settings-section">
				<div class="settings-section-title faint">{role.label}</div>

				<label class="field-row">
					<span class="field-label faint">URL</span>
					<input
						class="field-input"
						type="url"
						placeholder={roleData.api_url ? `inherits: ${roleData.api_url}` : 'https://...'}
						bind:value={form[role.id].api_url}
					/>
				</label>
				{#if errors[`${role.id}.api_url`]}
					<p class="field-error">{errors[`${role.id}.api_url`]}</p>
				{/if}

				<label class="field-row">
					<span class="field-label faint">Model</span>
					<input
						class="field-input"
						type="text"
						list={`models-${role.id}`}
						placeholder="model name"
						bind:value={form[role.id].model}
					/>
					<button
						class="btn btn-ghost"
						style="font-size:12px; padding:2px 6px"
						title="List models from endpoint"
						disabled={m.status === 'loading'}
						onclick={() => loadModels(role.id)}>{m.status === 'loading' ? '…' : '↻'}</button
					>
				</label>
				<datalist id={`models-${role.id}`}>
					{#each m.list as name (name)}
						<option value={name}></option>
					{/each}
				</datalist>
				{#if m.status === 'error'}
					<p class="field-error">Could not list models: {m.error}</p>
				{:else if m.list.length > 0}
					<p class="faint" style="font-size:11px; margin:2px 0 0 52px">
						{m.list.length} models available
					</p>
				{/if}

				<div class="field-row">
					<span class="field-label faint">Key</span>
					{#if roleData.has_own_key && !form[role.id].showKey}
						<span class="mono faint" style="font-size:12px">••••••••</span>
						<button
							class="btn btn-ghost"
							style="font-size:12px; padding:2px 6px"
							onclick={() => {
								form[role.id].showKey = true;
							}}>Rotate key</button
						>
					{:else if roleData.inherits_key && !form[role.id].showKey}
						<span class="faint" style="font-size:12px">inherits global</span>
						<button
							class="btn btn-ghost"
							style="font-size:12px; padding:2px 6px"
							onclick={() => {
								form[role.id].showKey = true;
							}}>Override</button
						>
					{:else}
						<input
							class="field-input"
							type="password"
							placeholder={roleData.has_own_key ? 'new key (leave blank to keep)' : 'API key'}
							bind:value={form[role.id].api_key}
						/>
						<button
							class="btn btn-ghost"
							style="font-size:12px; padding:2px 6px"
							onclick={() => {
								form[role.id].showKey = false;
								form[role.id].api_key = '';
							}}>Cancel</button
						>
					{/if}
				</div>

				{#if probeResults?.[role.id]}
					{@const r = probeResults[role.id]!}
					<p class="probe-result" class:ok={r.reachable} class:fail={!r.reachable}>
						{#if r.reachable}
							OK ({r.latency_ms}ms)
						{:else}
							{r.error ?? 'unreachable'}
						{/if}
					</p>
				{/if}
			</section>
		{/each}

		<div class="settings-actions">
			<button class="btn" onclick={save} disabled={saveMutation.isPending}>
				{saveStatus === 'saving' ? 'Saving...' : saveStatus === 'saved' ? 'Saved' : 'Save'}
			</button>
			<button class="btn btn-ghost" onclick={probe} disabled={probeStatus === 'probing'}>
				{probeStatus === 'probing' ? 'Testing...' : 'Test connectivity'}
			</button>
			{#if saveStatus === 'error'}
				<span class="field-error">Save failed.</span>
			{/if}
			{#if probeStatus === 'error'}
				<span class="field-error">Test request failed.</span>
			{:else if probeRan && probeResults && Object.keys(probeResults).length === 0}
				<span class="faint" style="font-size:12px">No endpoints configured to test.</span>
			{/if}
		</div>
	{/if}
</div>

<style>
	.inference-settings {
		display: flex;
		flex-direction: column;
		gap: 0;
	}

	.global-section {
		padding-bottom: 14px;
		border-bottom: 1px solid var(--line);
	}

	.field-row {
		display: flex;
		align-items: center;
		gap: 8px;
		margin-top: 6px;
	}

	.field-label {
		font-size: 12px;
		min-width: 44px;
	}

	.field-input {
		flex: 1;
		font-size: 12px;
		padding: 3px 6px;
		border: 1px solid var(--border);
		border-radius: 4px;
		background: var(--bg);
		color: var(--text);
	}

	.field-error {
		font-size: 11px;
		color: var(--red, #c0392b);
		margin: 2px 0 0 52px;
	}

	.probe-result {
		font-size: 11px;
		margin: 4px 0 0 52px;
	}

	.probe-result.ok {
		color: var(--green, #27ae60);
	}

	.probe-result.fail {
		color: var(--red, #c0392b);
	}

	.settings-actions {
		display: flex;
		align-items: center;
		gap: 8px;
		padding: 12px 0 4px;
	}
</style>
