<script lang="ts">
	import { onMount } from 'svelte';
	import { getWorkbenchContext } from '$lib/state/workbench.svelte';
	import {
		checkoutTrackCard,
		createTrack,
		createTrackBin,
		fetchTrackBoard,
		fetchTrackDetail,
		fetchTrackFollowups,
		markFollowupMoved,
		markFollowupStillAccurate,
		moveTrackCard,
		openTrackQuery,
		searchTracks,
		skipTrackFollowup,
		uploadTrackPhoto
	} from '$lib/api/tracks';
	import type {
		TrackBoardCard,
		TrackBoardResponse,
		TrackDetailResponse,
		TrackFollowUp,
		TrackRecord,
		TrackSearchResponse
	} from '$lib/types';

	const { paneIndex, trackId = null }: { paneIndex: 0 | 1; trackId?: number | null } = $props();
	const wb = getWorkbenchContext();

	let q = $state('');
	let search = $state<TrackSearchResponse | null>(null);
	let detail = $state<TrackDetailResponse | null>(null);
	let board = $state<TrackBoardResponse | null>(null);
	let followups = $state<TrackFollowUp[]>([]);
	let status = $state('');
	let error = $state('');
	let saving = $state(false);
	let text = $state('');
	let photo = $state<File | null>(null);
	let binName = $state('');
	let displacedOnly = $state(false);
	let movingCardKey = $state('');
	let moveBinId = $state('');
	let checkoutContext = $state('');
	let followupText = $state<Record<number, string>>({});

	const primary = $derived(search?.primary ?? null);
	const allCards = $derived<TrackBoardCard[]>([
		...(board?.cards ?? []),
		...(board?.unbinned ?? [])
	]);

	function photoUrl(record: TrackRecord): string | null {
		return record.photo_ref ? `/api/tracks/photos/${record.photo_ref}/raw` : null;
	}

	async function loadBoard() {
		board = await fetchTrackBoard(displacedOnly ? 'only' : 'all');
	}

	async function refresh() {
		try {
			await Promise.all([
				loadBoard(),
				fetchTrackFollowups().then((data) => (followups = data.followups))
			]);
		} catch (err) {
			error = `Tracking refresh did not complete: ${String(err)}`;
		}
	}

	onMount(() => {
		refresh();
		if (trackId) openDetail(trackId, false);
	});

	async function runSearch() {
		const trimmed = q.trim();
		if (!trimmed) {
			error = 'Enter something to find.';
			return;
		}
		error = '';
		status = 'Searching tracking records...';
		try {
			search = await searchTracks(trimmed);
			status = search.primary ? 'Best match ready.' : 'No matching track yet.';
		} catch (err) {
			error = `Search could not run: ${String(err)}`;
			status = '';
		}
	}

	async function openDetail(id: number, recordOpen = true) {
		error = '';
		try {
			if (recordOpen && search?.query_id) await openTrackQuery(search.query_id, id);
			detail = await fetchTrackDetail(id);
			wb.openInPane(paneIndex, { kind: 'tracking-detail', trackId: id }, { recordHistory: false });
		} catch (err) {
			error = `Could not open that track: ${String(err)}`;
		}
	}

	async function saveTrack() {
		const trimmed = text.trim();
		if (!trimmed) {
			error = 'Write the item and where it is before saving.';
			return;
		}
		saving = true;
		error = '';
		try {
			const uploaded = photo ? await uploadTrackPhoto(photo) : null;
			const created = await createTrack({
				text: trimmed,
				captured_at: new Date().toISOString(),
				photo_ref: uploaded?.ref ?? null
			});
			text = '';
			photo = null;
			status = `Saved track ${created.id}.`;
			await refresh();
		} catch (err) {
			error = `Save did not finish: ${String(err)}`;
		} finally {
			saving = false;
		}
	}

	function binExists(name: string) {
		const normalized = name.trim().toLowerCase().replace(/\s+/g, ' ');
		return (board?.bins ?? []).some((bin) => bin.normalized_name === normalized);
	}

	async function addBin(name = binName) {
		const trimmed = name.trim();
		if (!trimmed) return;
		try {
			await createTrackBin(trimmed);
			if (name === binName) binName = '';
			status = `Created bin ${trimmed}.`;
			await loadBoard();
		} catch (err) {
			error = `Could not create bin: ${String(err)}`;
		}
	}

	async function moveSelected(card: TrackBoardCard) {
		const toBinId = Number.parseInt(moveBinId, 10);
		if (!toBinId) return;
		try {
			await moveTrackCard({
				item_phrase: card.item_phrase,
				from_track_id: card.current_track.id,
				to_bin_id: toBinId
			});
			movingCardKey = '';
			moveBinId = '';
			await loadBoard();
		} catch (err) {
			error = `Move did not finish: ${String(err)}`;
		}
	}

	async function checkout(card: TrackBoardCard) {
		try {
			await checkoutTrackCard({
				item_phrase: card.item_phrase,
				from_track_id: card.current_track.id,
				context: checkoutContext || card.location_label || 'with me'
			});
			checkoutContext = '';
			await loadBoard();
		} catch (err) {
			error = `Checkout did not finish: ${String(err)}`;
		}
	}

	async function closeFollowup(followup: TrackFollowUp, action: 'still' | 'moved' | 'skip') {
		try {
			if (action === 'still') await markFollowupStillAccurate(followup.query_id);
			else if (action === 'skip') await skipTrackFollowup(followup.query_id);
			else {
				const movedText = followupText[followup.query_id]?.trim();
				if (!movedText) {
					error = 'Enter the new place before marking moved.';
					return;
				}
				await markFollowupMoved(followup.query_id, { text: movedText });
			}
			await refresh();
		} catch (err) {
			error = `Follow-up did not finish: ${String(err)}`;
		}
	}
</script>

<section class="tracking-shell" aria-labelledby="tracking-title">
	<header class="tracking-hero">
		<div>
			<p class="eyebrow">Tracking</p>
			<h1 id="tracking-title">Find and place real-world items</h1>
			<p>Search remembered locations, save new notes, and organize current item cards.</p>
		</div>
		<button class="btn btn-ghost" onclick={() => wb.openInPane(paneIndex, { kind: 'tracking' })}
			>Workspace</button
		>
	</header>

	{#if status}<p role="status" aria-live="polite" class="status">{status}</p>{/if}
	{#if error}<p role="alert" class="error">{error}</p>{/if}

	<div class="tracking-grid">
		<section class="panel search-panel" aria-label="Search tracking records">
			<h2>Search</h2>
			<form
				onsubmit={(event) => {
					event.preventDefault();
					runSearch();
				}}
			>
				<label for="track-search">Item or place</label>
				<div class="inline-form">
					<input id="track-search" bind:value={q} placeholder="keys by the router" />
					<button class="btn btn-primary" type="submit">Search</button>
				</div>
			</form>

			{#if primary}
				<article class="result-card primary">
					<p class="eyebrow">Best match</p>
					<h3>{primary.text}</h3>
					{#if photoUrl(primary)}<img
							class="photo-preview"
							src={photoUrl(primary)}
							alt="Photo preview for {primary.text}"
						/>{/if}
					<p>{primary.source} · {primary.captured_at}</p>
					{#if primary.photo_ref}<span class="pill">photo attached</span>{/if}
					{#if primary.displaced}<span class="pill">away from usual place</span>{/if}
					<button class="btn btn-ghost" onclick={() => openDetail(primary.id)}>Open record</button>
				</article>
			{:else if search?.empty_message}
				<p class="empty">{search.empty_message}</p>
			{/if}

			{#if search?.history.length}
				<h3>History</h3>
				{#each search.history as record (record.id)}
					<button class="result-row" onclick={() => openDetail(record.id)}>
						{#if photoUrl(record)}<img
								class="photo-thumb"
								src={photoUrl(record)}
								alt="Photo preview for {record.text}"
							/>{/if}
						<span>{record.text}</span>
						<small>{record.captured_at}{record.photo_ref ? ' · photo attached' : ''}</small>
					</button>
				{/each}
			{/if}
		</section>

		<section class="panel" aria-label="Add a tracking record">
			<h2>Add Track</h2>
			<label for="track-text">Item and place</label>
			<textarea
				id="track-text"
				bind:value={text}
				rows="4"
				placeholder="bike lock in the hallway shelf"
			></textarea>
			<label for="track-photo">Optional photo</label>
			<input
				id="track-photo"
				type="file"
				accept="image/*"
				onchange={(event) => (photo = event.currentTarget.files?.[0] ?? null)}
			/>
			<button class="btn btn-primary" disabled={saving} onclick={saveTrack}
				>{saving ? 'Saving...' : 'Save track'}</button
			>
		</section>
	</div>

	{#if detail}
		<section class="panel detail-panel" aria-label="Tracking record detail">
			<h2>{detail.record.text}</h2>
			<p>{detail.record.source} · {detail.record.captured_at}</p>
			{#if detail.record.displaced}<span class="pill">away from usual place</span>{/if}
			{#if photoUrl(detail.record)}<img
					src={photoUrl(detail.record)}
					alt="Tracking attachment for {detail.record.text}"
				/>{/if}
			<div class="detail-columns">
				<div>
					<h3>Same item history</h3>
					{#each detail.same_item_history as record (record.id)}<p>{record.text}</p>{:else}<p
							class="empty"
						>
							No older entries.
						</p>{/each}
				</div>
				<div>
					<h3>Related places</h3>
					{#each detail.related_location_tracks as record (record.id)}<p>{record.text}</p>{:else}<p
							class="empty"
						>
							No related place entries.
						</p>{/each}
				</div>
			</div>
		</section>
	{/if}

	<section class="panel" aria-label="Tracking board">
		<div class="section-row">
			<h2>Board</h2>
			<label class="check"
				><input type="checkbox" bind:checked={displacedOnly} onchange={loadBoard} /> Show only away items</label
			>
		</div>
		<form
			class="inline-form"
			onsubmit={(event) => {
				event.preventDefault();
				addBin();
			}}
		>
			<label class="sr-only" for="track-bin">New bin</label>
			<input id="track-bin" bind:value={binName} placeholder="garage shelf" />
			<button class="btn btn-ghost" type="submit">Create bin</button>
		</form>
		<p class="empty">{board?.displaced_count ?? 0} items are marked away from their usual place.</p>
		<div class="board-grid">
			{#each allCards as card (card.item_key)}
				<article class="board-card">
					<h3>{card.item_phrase}</h3>
					<p>{card.location_label ?? 'No bin yet'}</p>
					{#if card.displaced}<span class="pill">away</span>{/if}
					{#if card.location_label && !binExists(card.location_label)}
						<button
							class="btn btn-ghost"
							onclick={() => addBin(card.location_label ?? '')}
							aria-label="Create bin from {card.location_label}"
						>
							Create bin from {card.location_label}
						</button>
					{/if}
					<div class="card-actions">
						<button class="btn btn-ghost" onclick={() => openDetail(card.current_track.id)}
							>History</button
						>
						<button class="btn btn-ghost" onclick={() => (movingCardKey = card.item_key)}
							>Move</button
						>
						<button class="btn btn-ghost" onclick={() => checkout(card)}>Check out</button>
					</div>
					{#if movingCardKey === card.item_key}
						<div class="inline-form">
							<select bind:value={moveBinId} aria-label="Destination bin">
								<option value="">Choose bin</option>
								{#each board?.bins ?? [] as bin (bin.id)}<option value={String(bin.id)}
										>{bin.name}</option
									>{/each}
							</select>
							<button class="btn btn-primary" onclick={() => moveSelected(card)}>Place</button>
						</div>
					{/if}
				</article>
			{/each}
		</div>
		<label for="checkout-context">Checkout context</label>
		<input id="checkout-context" bind:value={checkoutContext} placeholder="with me / in use" />
	</section>

	<section class="panel" aria-label="Tracking follow-ups">
		<h2>Follow-ups</h2>
		{#each followups as followup (followup.query_id)}
			<article class="followup-row">
				<div>
					<strong>{followup.query}</strong>
					<p>{followup.opened_track.text}</p>
				</div>
				<input
					bind:value={followupText[followup.query_id]}
					placeholder="new place"
					aria-label="Moved place for {followup.query}"
				/>
				<button class="btn btn-primary" onclick={() => closeFollowup(followup, 'still')}
					>{followup.affirmative_label}</button
				>
				<button class="btn btn-ghost" onclick={() => closeFollowup(followup, 'moved')}>Moved</button
				>
				<button class="btn btn-ghost" onclick={() => closeFollowup(followup, 'skip')}>Skip</button>
			</article>
		{:else}
			<p class="empty">No follow-ups right now.</p>
		{/each}
	</section>
</section>

<style>
	.tracking-shell {
		height: 100%;
		overflow: auto;
		padding: 28px;
		color: var(--c-text);
	}
	.tracking-hero,
	.section-row {
		display: flex;
		justify-content: space-between;
		gap: 16px;
		align-items: flex-start;
	}
	.tracking-hero {
		margin-bottom: 18px;
	}
	.tracking-hero h1 {
		margin: 0;
		font-size: clamp(28px, 4vw, 46px);
		letter-spacing: -0.04em;
	}
	.tracking-hero p {
		max-width: 62ch;
		color: var(--c-muted);
	}
	.eyebrow {
		margin: 0 0 6px;
		color: var(--c-accent);
		font-size: 12px;
		text-transform: uppercase;
		letter-spacing: 0.14em;
	}
	.tracking-grid,
	.detail-columns {
		display: grid;
		grid-template-columns: minmax(0, 1.2fr) minmax(280px, 0.8fr);
		gap: 16px;
	}
	.panel {
		margin: 16px 0;
		padding: 18px;
		border: 1px solid var(--c-border);
		border-radius: 22px;
		background: color-mix(in srgb, var(--c-panel) 92%, transparent);
		box-shadow: 0 18px 60px rgb(0 0 0 / 0.08);
	}
	.panel h2,
	.panel h3 {
		margin-top: 0;
	}
	.inline-form,
	.card-actions,
	.followup-row {
		display: flex;
		gap: 10px;
		flex-wrap: wrap;
		align-items: center;
	}
	label {
		display: block;
		margin: 12px 0 6px;
		font-size: 13px;
		color: var(--c-muted);
	}
	input,
	textarea,
	select {
		width: 100%;
		min-width: 0;
		border: 1px solid var(--c-border);
		border-radius: 12px;
		padding: 10px 12px;
		background: var(--c-bg);
		color: var(--c-text);
	}
	.inline-form input,
	.inline-form select {
		flex: 1 1 220px;
	}
	.status {
		color: var(--c-ok);
	}
	.error {
		color: var(--c-alarm);
	}
	.result-card,
	.board-card,
	.followup-row {
		border: 1px solid var(--c-border);
		border-radius: 16px;
		padding: 14px;
		background: var(--c-bg);
	}
	.primary {
		border-color: var(--c-accent);
	}
	.result-row {
		width: 100%;
		display: flex;
		justify-content: space-between;
		align-items: center;
		gap: 12px;
		margin: 8px 0;
		padding: 10px;
		border: 1px solid var(--c-border);
		border-radius: 12px;
		background: transparent;
		color: inherit;
		text-align: left;
	}
	.photo-preview,
	.photo-thumb {
		object-fit: cover;
		border: 1px solid var(--c-border);
		border-radius: 12px;
	}
	.photo-preview {
		width: min(100%, 220px);
		max-height: 160px;
	}
	.photo-thumb {
		width: 48px;
		height: 48px;
		flex: 0 0 auto;
	}
	.pill {
		display: inline-flex;
		border: 1px solid var(--c-accent);
		border-radius: 999px;
		padding: 3px 8px;
		font-size: 12px;
		color: var(--c-accent);
	}
	.empty {
		color: var(--c-muted);
	}
	.detail-panel img {
		max-width: 260px;
		border-radius: 14px;
		border: 1px solid var(--c-border);
	}
	.board-grid {
		display: grid;
		grid-template-columns: repeat(auto-fit, minmax(220px, 1fr));
		gap: 12px;
		margin-top: 14px;
	}
	.check {
		display: inline-flex;
		gap: 8px;
		align-items: center;
	}
	.check input {
		width: auto;
	}
	.sr-only {
		position: absolute;
		width: 1px;
		height: 1px;
		padding: 0;
		margin: -1px;
		overflow: hidden;
		clip: rect(0, 0, 0, 0);
		white-space: nowrap;
		border: 0;
	}
	@media (max-width: 760px) {
		.tracking-shell {
			padding: 16px;
		}
		.tracking-grid,
		.detail-columns {
			grid-template-columns: 1fr;
		}
		.tracking-hero,
		.section-row {
			display: block;
		}
	}
</style>
