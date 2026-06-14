<script lang="ts">
	import { createQuery, createMutation, useQueryClient } from '@tanstack/svelte-query';
	import { browser } from '$app/environment';
	import {
		settingsKeys,
		fetchInferenceSettings,
		updateInferenceSettings,
		probeInferenceEndpoints,
		type InferenceUpdateBody,
		type ProbeResponse
	} from '$lib/api/settings';

	const qc = useQueryClient();

	const query = createQuery(() => ({
		queryKey: settingsKeys.inference(),
		queryFn: fetchInferenceSettings,
		enabled: browser
	}));

	type RoleId = 'embed' | 'rerank' | 'expand' | 'asr';

	const roles: { id: RoleId; label: string; hasUrl: boolean }[] = [
		{ id: 'embed', label: 'Embed', hasUrl: true },
		{ id: 'rerank', label: 'Rerank', hasUrl: true },
		{ id: 'expand', label: 'Expand', hasUrl: true },
		{ id: 'asr', label: 'ASR', hasUrl: false }
	];

	let form = $state<
		Record<RoleId, { api_url: string; model: string; api_key: string; showKey: boolean }>
	>({
		embed: { api_url: '', model: '', api_key: '', showKey: false },
		rerank: { api_url: '', model: '', api_key: '', showKey: false },
		expand: { api_url: '', model: '', api_key: '', showKey: false },
		asr: { api_url: '', model: '', api_key: '', showKey: false }
	});

	let errors = $state<Record<string, string>>({});
	let saveStatus = $state<'' | 'saving' | 'saved' | 'error'>('');
	let saveTimer: ReturnType<typeof setTimeout> | undefined;

	let probeStatus = $state<'' | 'probing'>('');
	let probeResults = $state<ProbeResponse | null>(null);

	$effect(() => {
		const data = query.data;
		if (!data) return;
		for (const role of roles) {
			form[role.id].api_url = data[role.id].api_url ?? '';
			form[role.id].model = data[role.id].model ?? '';
		}
	});

	const saveMutation = createMutation(() => ({
		mutationFn: (body: InferenceUpdateBody) => updateInferenceSettings(body),
		onSuccess: () => {
			qc.invalidateQueries({ queryKey: settingsKeys.inference() });
			errors = {};
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
		for (const role of roles) {
			const f = form[role.id];
			body[role.id] = {
				...(role.hasUrl ? { api_url: f.api_url || null } : {}),
				model: f.model || null,
				...(f.showKey ? { api_key: f.api_key || null } : {})
			};
		}
		return body;
	}

	function save() {
		saveStatus = 'saving';
		errors = {};
		saveMutation.mutate(buildBody());
	}

	async function probe() {
		probeStatus = 'probing';
		probeResults = null;
		try {
			probeResults = await probeInferenceEndpoints();
		} finally {
			probeStatus = '';
		}
	}
</script>

<div class="inference-settings">
	{#if query.isLoading}
		<p class="faint" style="font-size:13px">Loading...</p>
	{:else if query.isError}
		<p class="faint" style="font-size:13px">Failed to load settings.</p>
	{:else}
		{#each roles as role (role.id)}
			{@const roleData = query.data?.[role.id]}
			<section class="settings-section">
				<div class="settings-section-title faint">{role.label}</div>

				{#if role.hasUrl}
					<label class="field-row">
						<span class="field-label faint">URL</span>
						<input
							class="field-input"
							type="url"
							placeholder="https://..."
							bind:value={form[role.id].api_url}
						/>
					</label>
					{#if errors[`${role.id}.api_url`]}
						<p class="field-error">{errors[`${role.id}.api_url`]}</p>
					{/if}
				{/if}

				<label class="field-row">
					<span class="field-label faint">Model</span>
					<input
						class="field-input"
						type="text"
						placeholder="model name"
						bind:value={form[role.id].model}
					/>
				</label>

				<div class="field-row">
					<span class="field-label faint">Key</span>
					{#if roleData?.has_key && !form[role.id].showKey}
						<span class="mono faint" style="font-size:12px">••••••••</span>
						<button
							class="btn btn-ghost"
							style="font-size:12px; padding:2px 6px"
							onclick={() => {
								form[role.id].showKey = true;
							}}>Rotate key</button
						>
					{:else}
						<input
							class="field-input"
							type="password"
							placeholder={roleData?.has_key ? 'new key (leave blank to keep)' : 'API key'}
							bind:value={form[role.id].api_key}
						/>
						{#if roleData?.has_key}
							<button
								class="btn btn-ghost"
								style="font-size:12px; padding:2px 6px"
								onclick={() => {
									form[role.id].showKey = false;
									form[role.id].api_key = '';
								}}>Cancel</button
							>
						{/if}
					{/if}
				</div>

				{#if probeResults?.[role.id as 'embed' | 'rerank' | 'expand']}
					{@const r = probeResults[role.id as 'embed' | 'rerank' | 'expand']!}
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
		</div>
	{/if}
</div>

<style>
	.inference-settings {
		display: flex;
		flex-direction: column;
		gap: 0;
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
