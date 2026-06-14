<script lang="ts">
	import { createQuery, createMutation, useQueryClient } from '@tanstack/svelte-query';
	import { browser } from '$app/environment';
	import {
		settingsKeys,
		fetchSecuritySettings,
		rotateAgentToken,
		setAgentToken
	} from '$lib/api/settings';

	const qc = useQueryClient();

	const query = createQuery(() => ({
		queryKey: settingsKeys.security(),
		queryFn: fetchSecuritySettings,
		enabled: browser
	}));

	let newToken = $state<string | null>(null);
	let copied = $state(false);

	let showCustomForm = $state(false);
	let customToken = $state('');
	let customError = $state('');
	let customSaved = $state(false);

	const rotateMutation = createMutation(() => ({
		mutationFn: rotateAgentToken,
		onSuccess: (data) => {
			newToken = data.token;
			qc.invalidateQueries({ queryKey: settingsKeys.security() });
		}
	}));

	const setTokenMutation = createMutation(() => ({
		mutationFn: (token: string) => setAgentToken(token),
		onSuccess: () => {
			qc.invalidateQueries({ queryKey: settingsKeys.security() });
			showCustomForm = false;
			customToken = '';
			customError = '';
			customSaved = true;
			setTimeout(() => {
				customSaved = false;
			}, 2000);
		},
		onError: (err: unknown) => {
			customError = '';
			if (
				err &&
				typeof err === 'object' &&
				'status' in err &&
				(err as { status: number }).status === 422
			) {
				customError = 'Token must be at least 16 characters.';
			} else {
				customError = 'Failed to set token.';
			}
		}
	}));

	async function copyToken() {
		if (!newToken) return;
		await navigator.clipboard.writeText(newToken);
		copied = true;
		setTimeout(() => {
			copied = false;
		}, 2000);
	}
</script>

<div class="security-settings">
	{#if query.isLoading}
		<p class="faint" style="font-size:13px">Loading...</p>
	{:else if query.isError}
		<p class="faint" style="font-size:13px">Failed to load settings.</p>
	{:else}
		{@const data = query.data}
		<section class="settings-section">
			<div class="settings-section-title faint">Agent token</div>
			<div class="token-source faint" style="font-size:12px; margin-bottom:8px">
				Source: <span class="mono">{data?.agent_token_source ?? 'unknown'}</span>
				{#if data?.has_agent_token}
					&mdash; token configured
				{:else}
					&mdash; <span style="color:var(--red,#c0392b)">no token set</span>
				{/if}
			</div>

			{#if newToken}
				<div class="token-reveal">
					<p class="warn-msg">Copy this token now. It will not be shown again.</p>
					<div class="token-box">
						<textarea readonly rows={2}>{newToken}</textarea>
						<button class="btn btn-ghost" onclick={copyToken}>
							{copied ? 'Copied!' : 'Copy'}
						</button>
					</div>
					<button
						class="btn btn-ghost"
						style="font-size:12px"
						onclick={() => {
							newToken = null;
						}}>Done</button
					>
				</div>
			{:else}
				<button
					class="btn"
					onclick={() => rotateMutation.mutate()}
					disabled={rotateMutation.isPending}
				>
					{rotateMutation.isPending ? 'Rotating...' : 'Rotate token'}
				</button>
			{/if}
		</section>

		<section class="settings-section">
			<div class="settings-section-title faint">Custom token</div>
			{#if showCustomForm}
				<div class="field-row">
					<input
						class="field-input"
						type="password"
						placeholder="min 16 characters"
						bind:value={customToken}
					/>
					<button
						class="btn"
						onclick={() => setTokenMutation.mutate(customToken)}
						disabled={setTokenMutation.isPending}>Set</button
					>
					<button
						class="btn btn-ghost"
						onclick={() => {
							showCustomForm = false;
							customToken = '';
							customError = '';
						}}>Cancel</button
					>
				</div>
				{#if customError}
					<p class="field-error">{customError}</p>
				{/if}
				{#if customSaved}
					<p class="field-ok">Token updated.</p>
				{/if}
			{:else}
				<button
					class="btn btn-ghost"
					onclick={() => {
						showCustomForm = true;
					}}
				>
					Set custom token
				</button>
			{/if}
		</section>
	{/if}
</div>

<style>
	.security-settings {
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
		margin-top: 4px;
	}

	.field-ok {
		font-size: 11px;
		color: var(--green, #27ae60);
		margin-top: 4px;
	}

	.token-reveal {
		display: flex;
		flex-direction: column;
		gap: 6px;
	}

	.warn-msg {
		font-size: 12px;
		color: var(--amber, #d68910);
		margin: 0;
	}

	.token-box {
		display: flex;
		gap: 6px;
		align-items: flex-start;
	}

	.token-box textarea {
		flex: 1;
		font-family: monospace;
		font-size: 11px;
		resize: none;
		padding: 4px 6px;
		border: 1px solid var(--border);
		border-radius: 4px;
		background: var(--bg);
		color: var(--text);
		word-break: break-all;
	}
</style>
