<script lang="ts">
	import { onMount } from 'svelte';
	import { getWorkbenchContext } from '$lib/state/workbench.svelte';
	import { ApiError } from '$lib/api/client';
	import Icon from '$components/icons/Icon.svelte';
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
		TrackBin,
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
	let draggingCardKey = $state('');
	let dropBinId = $state<number | null>(null);
	let movingCardKey = $state('');
	let moveBinId = $state('');
	let checkoutContext = $state('');
	let followupText = $state<Record<number, string>>({});

	type BinGroup = { bin: TrackBin; cards: TrackBoardCard[] };

	const primary = $derived(search?.primary ?? null);
	const allCards = $derived<TrackBoardCard[]>([
		...(board?.cards ?? []),
		...(board?.unbinned ?? [])
	]);
	const visibleCardsCount = $derived(allCards.length);
	const binGroups = $derived.by((): BinGroup[] =>
		(board?.bins ?? []).map((bin) => ({
			bin,
			cards: (board?.cards ?? []).filter((card) => card.bin_id === bin.id)
		}))
	);
	const unplacedCards = $derived.by(() => {
		const binIds = new Set((board?.bins ?? []).map((bin) => bin.id));
		return [
			...(board?.unbinned ?? []),
			...(board?.cards ?? []).filter((card) => card.bin_id !== null && !binIds.has(card.bin_id))
		];
	});

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

	function normalizedBinName(name: string) {
		return name.trim().toLowerCase().replace(/\s+/g, ' ');
	}

	function existingBin(name: string) {
		const normalized = normalizedBinName(name);
		return (board?.bins ?? []).find((bin) => bin.normalized_name === normalized) ?? null;
	}

	function binExists(name: string) {
		return existingBin(name) !== null;
	}

	function cardByKey(key: string) {
		return allCards.find((card) => card.item_key === key) ?? null;
	}

	function binById(id: number) {
		return (board?.bins ?? []).find((bin) => bin.id === id) ?? null;
	}

	function duplicateBinName(err: unknown, fallback: string) {
		if (!(err instanceof ApiError) || err.status !== 409) return null;
		try {
			const body = JSON.parse(err.body) as { bin?: { name?: unknown } };
			return typeof body.bin?.name === 'string' ? body.bin.name : fallback;
		} catch {
			return fallback;
		}
	}

	function clearBinInputIfManual(name: string) {
		if (name === binName) binName = '';
	}

	function markBinAlreadyExists(name: string) {
		clearBinInputIfManual(name);
		status = `Place already exists: ${name}.`;
		error = '';
	}

	async function addBin(name = binName) {
		const trimmed = name.trim();
		if (!trimmed) return;
		const existing = existingBin(trimmed);
		if (existing) {
			markBinAlreadyExists(existing.name);
			await loadBoard();
			return;
		}
		try {
			await createTrackBin(trimmed);
			clearBinInputIfManual(name);
			status = `Created bin ${trimmed}.`;
			await loadBoard();
		} catch (err) {
			const duplicateName = duplicateBinName(err, trimmed);
			if (duplicateName) {
				markBinAlreadyExists(duplicateName);
				await loadBoard();
				return;
			}
			error = `Could not create bin: ${String(err)}`;
		}
	}

	async function placeCardInBin(card: TrackBoardCard, toBinId: number) {
		const bin = binById(toBinId);
		if (card.bin_id === toBinId) {
			status = `${card.item_phrase} is already in ${bin?.name ?? 'that bin'}.`;
			error = '';
			return true;
		}
		try {
			await moveTrackCard({
				item_phrase: card.item_phrase,
				from_track_id: card.current_track.id,
				to_bin_id: toBinId
			});
			status = `Moved ${card.item_phrase} to ${bin?.name ?? 'bin'}.`;
			error = '';
			await loadBoard();
			return true;
		} catch (err) {
			error = `Move did not finish: ${String(err)}`;
			return false;
		}
	}

	async function moveSelected(card: TrackBoardCard) {
		const toBinId = Number.parseInt(moveBinId, 10);
		if (!toBinId) return;
		const moved = await placeCardInBin(card, toBinId);
		if (moved) {
			movingCardKey = '';
			moveBinId = '';
		}
	}

	function startCardDrag(event: DragEvent, card: TrackBoardCard) {
		draggingCardKey = card.item_key;
		error = '';
		if (!event.dataTransfer) return;
		event.dataTransfer.effectAllowed = 'move';
		event.dataTransfer.setData('application/x-lattice-track-card', card.item_key);
		event.dataTransfer.setData('text/plain', card.item_phrase);
	}

	function endCardDrag() {
		draggingCardKey = '';
		dropBinId = null;
	}

	function allowBinDrop(event: DragEvent, binId: number) {
		if (
			!draggingCardKey &&
			!event.dataTransfer?.types.includes('application/x-lattice-track-card')
		) {
			return;
		}
		event.preventDefault();
		dropBinId = binId;
		if (event.dataTransfer) event.dataTransfer.dropEffect = 'move';
	}

	function leaveBinDrop(event: DragEvent, binId: number) {
		const current = event.currentTarget as HTMLElement;
		const next = event.relatedTarget as Node | null;
		if (next && current.contains(next)) return;
		if (dropBinId === binId) dropBinId = null;
	}

	async function dropOnBin(event: DragEvent, toBinId: number) {
		event.preventDefault();
		const key = event.dataTransfer?.getData('application/x-lattice-track-card') || draggingCardKey;
		dropBinId = null;
		if (!key) return;
		const card = cardByKey(key);
		if (!card) return;
		await placeCardInBin(card, toBinId);
		endCardDrag();
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

{#snippet boardCard(card: TrackBoardCard)}
	<article
		class={`board-card ${draggingCardKey === card.item_key ? 'board-card--dragging' : ''}`}
		draggable={true}
		ondragstart={(event) => startCardDrag(event, card)}
		ondragend={endCardDrag}
		aria-label="{card.item_phrase} item card"
	>
		<div class="board-card-main">
			<div class="board-card-title-row">
				<h3>{card.item_phrase}</h3>
				{#if card.displaced}<span class="chip chip-away">away</span>{/if}
			</div>
			<p>{card.location_label ?? 'No saved place'}</p>
		</div>

		<div class="card-actions">
			<button class="btn btn-ghost btn-mini" onclick={() => openDetail(card.current_track.id)}
				>History</button
			>
			<button class="btn btn-ghost btn-mini" onclick={() => (movingCardKey = card.item_key)}
				>Move</button
			>
			<button class="btn btn-ghost btn-mini" onclick={() => checkout(card)}>Check out</button>
		</div>

		{#if card.location_label && !binExists(card.location_label)}
			<div class="board-card-extra">
				<button
					class="btn btn-primary btn-mini"
					onclick={() => addBin(card.location_label ?? '')}
					aria-label="Create bin from {card.location_label}"
				>
					Create bin from {card.location_label}
				</button>
			</div>
		{/if}

		{#if movingCardKey === card.item_key}
			<div class="move-form">
				<select bind:value={moveBinId} aria-label="Destination bin">
					<option value="">Choose bin</option>
					{#each board?.bins ?? [] as bin (bin.id)}<option value={String(bin.id)}>{bin.name}</option
						>{/each}
				</select>
				<button class="btn btn-primary btn-mini" onclick={() => moveSelected(card)}>Place</button>
			</div>
		{/if}
	</article>
{/snippet}

{#snippet binCard(group: BinGroup)}
	<article
		class={`bin-card ${dropBinId === group.bin.id ? 'bin-card--drop-target' : ''}`}
		aria-label="{group.bin.name} bin"
		ondragenter={(event) => allowBinDrop(event, group.bin.id)}
		ondragover={(event) => allowBinDrop(event, group.bin.id)}
		ondragleave={(event) => leaveBinDrop(event, group.bin.id)}
		ondrop={(event) => dropOnBin(event, group.bin.id)}
	>
		<div class="bin-card-head">
			<div>
				<h3>{group.bin.name}</h3>
				<p>Drop item cards here</p>
			</div>
			<span class="count-soft">{group.cards.length}</span>
		</div>

		<div class="bin-stack">
			{#each group.cards as card (card.item_key)}
				{@render boardCard(card)}
			{:else}
				<p class="bin-empty">Empty bin. Drag a card into it.</p>
			{/each}
		</div>
	</article>
{/snippet}

<section class="tracking-scroll" aria-labelledby="tracking-title">
	<div class="tracking">
		<header class="tracking-head">
			<div>
				<p class="tracking-kicker">Tracking</p>
				<h1 class="home-title" id="tracking-title">Find and place real-world items</h1>
				<p class="home-sub soft">
					Search remembered places, save a new item note, and keep current locations tidy.
				</p>
			</div>
		</header>

		{#if status || error}
			<div class="tracking-messages">
				{#if status}<p role="status" aria-live="polite" class="status">{status}</p>{/if}
				{#if error}<p role="alert" class="error">{error}</p>{/if}
			</div>
		{/if}

		{#if followups.length}
			<section
				class="card home-section tracking-followups tracking-followups--priority"
				aria-label="Tracking follow-ups"
			>
				<div class="home-section-head">
					<h2 class="section-title">
						<Icon name="clock" size={16} />
						<span>Follow-ups</span>
						<span class="count-soft">{followups.length}</span>
					</h2>
					<span class="faint">confirm old answers</span>
				</div>

				{#each followups as followup (followup.query_id)}
					<article class="followup-row">
						<div class="followup-main">
							<strong>{followup.query}</strong>
							<p>{followup.opened_track.text}</p>
						</div>
						<input
							bind:value={followupText[followup.query_id]}
							placeholder="new place"
							aria-label="Moved place for {followup.query}"
						/>
						<button
							class="btn btn-primary btn-mini"
							onclick={() => closeFollowup(followup, 'still')}>{followup.affirmative_label}</button
						>
						<button class="btn btn-ghost btn-mini" onclick={() => closeFollowup(followup, 'moved')}
							>Moved</button
						>
						<button class="btn btn-ghost btn-mini" onclick={() => closeFollowup(followup, 'skip')}
							>Skip</button
						>
					</article>
				{/each}
			</section>
		{/if}

		<div class="tracking-workspace">
			<section class="card home-section tracking-board" aria-label="Tracking board">
				<div class="home-section-head">
					<h2 class="section-title">
						<Icon name="library" size={16} />
						<span>Tracking board</span>
						{#if board}<span class="count-soft">{board.bins.length} bins</span>{/if}
					</h2>
					<label class="check"
						><input type="checkbox" bind:checked={displacedOnly} onchange={loadBoard} /> Show only away
						items</label
					>
				</div>

				<div class="board-controls">
					<div class="board-guidance">
						<strong>Bin cards</strong>
						<p>Drag item cards into a bin. Use Move for keyboard placement.</p>
					</div>

					<form
						class="form-stack"
						onsubmit={(event) => {
							event.preventDefault();
							addBin();
						}}
					>
						<label for="track-bin">New bin</label>
						<div class="control-row">
							<input id="track-bin" bind:value={binName} placeholder="garage shelf" />
							<button class="btn btn-primary" type="submit">Create bin</button>
						</div>
					</form>

					{#if visibleCardsCount > 0}
						<div class="form-stack checkout-field">
							<label for="checkout-context">Checkout context</label>
							<input
								id="checkout-context"
								bind:value={checkoutContext}
								placeholder="with me / in use"
							/>
						</div>
					{/if}
				</div>

				{#if board === null}
					<p class="tracking-empty">Loading places...</p>
				{:else if visibleCardsCount === 0 && board.bins.length === 0}
					<div class="tracking-empty">
						<p>No item cards yet.</p>
						<p>Save a note like "bike lock in hallway shelf" and it will show up here.</p>
					</div>
				{:else}
					<div class="bin-board">
						{#if unplacedCards.length}
							<article class="bin-card bin-card--unplaced" aria-label="Unplaced item cards">
								<div class="bin-card-head">
									<div>
										<h3>Unplaced</h3>
										<p>Drag these into a bin card</p>
									</div>
									<span class="count-soft">{unplacedCards.length}</span>
								</div>

								<div class="bin-stack">
									{#each unplacedCards as card (card.item_key)}{@render boardCard(card)}{/each}
								</div>
							</article>
						{/if}

						{#each binGroups as group (group.bin.id)}
							{@render binCard(group)}
						{/each}

						{#if binGroups.length === 0}
							<div class="tracking-empty tracking-empty--board">
								<p>No bins yet.</p>
								<p>Create a bin, then drag item cards into it.</p>
							</div>
						{/if}
					</div>
				{/if}

				<div class="home-section-foot">
					<span class="faint"
						>{visibleCardsCount} item cards, {board?.displaced_count ?? 0} away from their usual place</span
					>
				</div>
			</section>

			<div class="tracking-tools">
				<section class="card home-section tracking-card" aria-label="Track an item placement">
					<div class="home-section-head">
						<h2 class="section-title">
							<Icon name="plus" size={16} />
							<span>Track</span>
						</h2>
						<span class="faint">item + place</span>
					</div>

					<div class="tracking-card-body">
						<label for="track-text">Item and place</label>
						<textarea
							id="track-text"
							bind:value={text}
							rows="3"
							placeholder="bike lock in the hallway shelf"
						></textarea>
						<label for="track-photo">Optional photo</label>
						<input
							class="file-input"
							id="track-photo"
							type="file"
							accept="image/*"
							onchange={(event) => (photo = event.currentTarget.files?.[0] ?? null)}
						/>
						<div class="form-actions">
							<button class="btn btn-primary" disabled={saving} onclick={saveTrack}
								>{saving ? 'Saving...' : 'Save track'}</button
							>
						</div>
					</div>
				</section>

				<section class="card home-section tracking-card" aria-label="Search tracking records">
					<div class="home-section-head">
						<h2 class="section-title">
							<Icon name="search" size={16} />
							<span>Search</span>
						</h2>
						<span class="faint">item or place</span>
					</div>

					<div class="tracking-card-body">
						<form
							class="form-stack"
							onsubmit={(event) => {
								event.preventDefault();
								runSearch();
							}}
						>
							<label for="track-search">Item or place</label>
							<div class="control-row">
								<input id="track-search" bind:value={q} placeholder="keys by the router" />
								<button class="btn btn-primary" type="submit">Search</button>
							</div>
						</form>

						{#if primary}
							<article class="track-record track-record--primary">
								<div class="track-record-head">
									{#if photoUrl(primary)}<img
											class="photo-preview"
											src={photoUrl(primary)}
											alt="Photo preview for {primary.text}"
										/>{/if}
									<div class="track-record-copy">
										<div class="track-meta">
											<span class="chip chip-accent">Best match</span>
											<span>{primary.source}</span>
											<span>·</span>
											<span>{primary.captured_at}</span>
										</div>
										<h3>{primary.text}</h3>
										<div class="track-meta">
											{#if primary.photo_ref}<span class="chip">photo attached</span>{/if}
											{#if primary.displaced}<span class="chip chip-away"
													>away from usual place</span
												>{/if}
										</div>
									</div>
								</div>
								<button class="btn btn-ghost btn-mini" onclick={() => openDetail(primary.id)}>
									Open record
								</button>
							</article>
						{:else if search?.empty_message}
							<p class="tracking-empty tracking-empty--inline">{search.empty_message}</p>
						{:else}
							<p class="tracking-empty tracking-empty--inline">
								Try a thing you misplaced or a place you remember.
							</p>
						{/if}

						{#if search?.history.length}
							<div class="subsection-head">
								<h3>History</h3>
								<span class="count-soft">{search.history.length}</span>
							</div>
							<div class="tracking-list">
								{#each search.history as record (record.id)}
									<button class="tracking-row" onclick={() => openDetail(record.id)}>
										{#if photoUrl(record)}<img
												class="photo-thumb"
												src={photoUrl(record)}
												alt="Photo preview for {record.text}"
											/>{/if}
										<span class="tracking-row-body">
											<span class="tracking-row-title">{record.text}</span>
											<span class="tracking-row-meta"
												>{record.captured_at}{record.photo_ref ? ' · photo attached' : ''}</span
											>
										</span>
									</button>
								{/each}
							</div>
						{/if}
					</div>
				</section>
			</div>
		</div>

		{#if detail}
			<section class="card home-section detail-panel" aria-label="Tracking record detail">
				<div class="home-section-head">
					<h2 class="section-title detail-title">
						<Icon name="doc" size={16} />
						<span>{detail.record.text}</span>
					</h2>
					<span class="faint">{detail.record.source} · {detail.record.captured_at}</span>
				</div>

				<div class="tracking-card-body">
					<div class="track-meta">
						{#if detail.record.displaced}<span class="chip chip-away">away from usual place</span
							>{/if}
					</div>
					{#if photoUrl(detail.record)}<img
							class="detail-photo"
							src={photoUrl(detail.record)}
							alt="Tracking attachment for {detail.record.text}"
						/>{/if}
					<div class="detail-columns">
						<div>
							<div class="subsection-head"><h3>Same item history</h3></div>
							<div class="detail-list">
								{#each detail.same_item_history as record (record.id)}<p>{record.text}</p>{:else}<p
										class="tracking-empty tracking-empty--inline"
									>
										No older entries.
									</p>{/each}
							</div>
						</div>
						<div>
							<div class="subsection-head"><h3>Related places</h3></div>
							<div class="detail-list">
								{#each detail.related_location_tracks as record (record.id)}<p>
										{record.text}
									</p>{:else}<p class="tracking-empty tracking-empty--inline">
										No related place entries.
									</p>{/each}
							</div>
						</div>
					</div>
				</div>
			</section>
		{/if}
	</div>
</section>

<style>
	.tracking-scroll {
		height: 100%;
		overflow-y: auto;
		overflow-x: hidden;
		color: var(--text);
	}

	.tracking {
		max-width: 1040px;
		margin: 0 auto;
		padding: 32px 32px 64px;
		display: flex;
		flex-direction: column;
		gap: 18px;
	}

	.tracking-head {
		display: flex;
		align-items: flex-end;
		justify-content: space-between;
		gap: 24px;
		margin-bottom: 4px;
	}

	.tracking-kicker {
		margin: 0 0 6px;
		color: var(--text-faint);
		font-size: 11px;
		text-transform: uppercase;
		letter-spacing: 0.1em;
	}

	.tracking-messages {
		display: flex;
		flex-direction: column;
		gap: 6px;
	}

	.tracking-workspace {
		display: grid;
		grid-template-columns: minmax(0, 1fr) minmax(320px, 0.55fr);
		gap: 18px;
		align-items: start;
	}

	.tracking-tools {
		display: flex;
		min-width: 0;
		flex-direction: column;
		gap: 18px;
	}

	.detail-columns {
		display: grid;
		grid-template-columns: repeat(2, minmax(0, 1fr));
		gap: 18px;
		align-items: start;
	}

	.tracking-card,
	.tracking-board,
	.tracking-followups,
	.detail-panel {
		padding: 0;
		overflow: hidden;
	}

	.tracking-card-body {
		padding: 16px 18px 18px;
		display: flex;
		flex-direction: column;
		gap: 12px;
	}

	.tracking-card :global(.home-section-head > .faint),
	.tracking-followups :global(.home-section-head > .faint),
	.detail-panel :global(.home-section-head > .faint) {
		font-size: 12px;
		white-space: nowrap;
		margin-left: 12px;
	}

	label {
		display: block;
		margin: 0;
		font-size: var(--fs-xs);
		color: var(--text-mute);
	}

	input,
	textarea,
	select {
		width: 100%;
		min-width: 0;
		border: 1px solid var(--line);
		border-radius: var(--radius-sm);
		padding: 7px 9px;
		background: var(--bg);
		color: var(--text);
		font-size: var(--fs-small);
		font-family: inherit;
	}

	textarea {
		min-height: 84px;
		resize: vertical;
		line-height: 1.45;
	}

	.file-input {
		padding: 0;
		color: var(--text-mute);
		line-height: 34px;
		cursor: pointer;
	}

	.file-input::file-selector-button {
		min-height: 34px;
		margin: 0 10px 0 0;
		border: 0;
		border-right: 1px solid var(--line);
		border-radius: var(--radius-sm) 0 0 var(--radius-sm);
		padding: 7px 10px;
		background: var(--bg-high);
		color: var(--text-soft);
		font: inherit;
		cursor: pointer;
		transition:
			background var(--t-fast) var(--ease),
			color var(--t-fast) var(--ease);
	}

	.file-input:hover::file-selector-button {
		background: var(--bg-raised);
		color: var(--text);
	}

	input:focus,
	textarea:focus,
	select:focus {
		border-color: var(--c-accent);
		outline: none;
		box-shadow: 0 0 0 2px color-mix(in oklch, var(--c-accent) 18%, transparent);
	}
	button:disabled {
		cursor: wait;
		opacity: 0.65;
	}

	.form-stack {
		display: flex;
		flex-direction: column;
		gap: 6px;
	}

	.control-row,
	.form-actions,
	.track-meta,
	.card-actions,
	.move-form {
		display: flex;
		align-items: center;
		gap: 8px;
		flex-wrap: wrap;
	}

	.control-row input,
	.move-form select {
		flex: 1 1 180px;
	}

	.form-actions {
		justify-content: flex-end;
		padding-top: 2px;
	}

	.status {
		margin: 0;
		color: var(--c-ok);
		font-size: var(--fs-small);
	}

	.error {
		margin: 0;
		color: var(--c-alarm);
		font-size: var(--fs-small);
	}

	.tracking-empty {
		margin: 0;
		padding: 24px 18px;
		color: var(--text-mute);
		font-size: var(--fs-small);
		text-align: center;
	}

	.tracking-empty p {
		margin: 0;
	}

	.tracking-empty p + p {
		margin-top: 4px;
		color: var(--text-faint);
	}

	.tracking-empty--inline {
		padding: 10px 0;
		text-align: left;
	}

	.track-record {
		border: 1px solid var(--line);
		border-radius: var(--radius-sm);
		padding: 12px;
		background: var(--bg);
		display: flex;
		flex-direction: column;
		gap: 10px;
	}

	.track-record--primary {
		border-color: color-mix(in oklch, var(--c-accent) 42%, var(--line));
	}

	.track-record-head {
		display: flex;
		align-items: flex-start;
		gap: 12px;
		min-width: 0;
	}

	.track-record-copy {
		min-width: 0;
		display: flex;
		flex-direction: column;
		gap: 6px;
	}

	.track-record h3,
	.subsection-head h3,
	.board-card h3 {
		margin: 0;
		font-size: 14.5px;
		font-weight: 600;
		letter-spacing: -0.01em;
	}

	.track-record h3 {
		font-size: 15px;
		line-height: 1.35;
	}

	.track-meta {
		gap: 6px;
		color: var(--text-mute);
		font-size: 12px;
	}

	.subsection-head {
		display: flex;
		align-items: center;
		gap: 8px;
		padding-top: 2px;
	}

	.tracking-list,
	.detail-list {
		border-top: 1px solid var(--line);
	}

	.tracking-row {
		width: 100%;
		display: flex;
		align-items: flex-start;
		gap: 12px;
		padding: 10px 0;
		border-bottom: 1px solid var(--line);
		background: transparent;
		color: inherit;
		text-align: left;
		transition: background var(--t-fast) var(--ease);
	}

	.tracking-row:hover {
		color: var(--c-accent);
	}

	.tracking-row-body {
		display: flex;
		flex-direction: column;
		gap: 2px;
		min-width: 0;
	}

	.tracking-row-title {
		font-size: 14px;
		line-height: 1.4;
		color: var(--text);
	}

	.tracking-row:hover .tracking-row-title {
		color: var(--c-accent);
	}

	.tracking-row-meta,
	.board-card p,
	.detail-panel p,
	.followup-row p {
		color: var(--text-mute);
		font-size: 12px;
	}

	.photo-preview,
	.photo-thumb {
		object-fit: cover;
		border: 1px solid var(--line);
		border-radius: var(--radius-sm);
	}

	.photo-preview {
		width: 84px;
		height: 68px;
		flex: 0 0 auto;
	}

	.photo-thumb {
		width: 42px;
		height: 42px;
		flex: 0 0 auto;
	}

	.chip-accent {
		color: var(--c-accent);
		background: color-mix(in oklch, var(--c-accent) 10%, transparent);
	}

	.chip-away {
		color: var(--c-caution);
		background: color-mix(in oklch, var(--c-caution) 12%, transparent);
	}

	.detail-title {
		min-width: 0;
	}

	.detail-title span:last-child {
		min-width: 0;
		overflow: hidden;
		text-overflow: ellipsis;
		white-space: nowrap;
	}

	.detail-photo {
		max-width: 260px;
		border-radius: var(--radius);
		border: 1px solid var(--line);
	}

	.detail-list p {
		margin: 0;
		padding: 9px 0;
		border-bottom: 1px solid var(--line);
	}

	.board-controls {
		display: grid;
		grid-template-columns: minmax(160px, 0.55fr) minmax(220px, 1fr) minmax(220px, 0.7fr);
		gap: 16px;
		padding: 14px 18px;
		border-bottom: 1px solid var(--line);
		background: var(--bg);
		align-items: end;
	}

	.board-guidance {
		align-self: center;
		min-width: 0;
	}

	.board-guidance strong {
		display: block;
		color: var(--text);
		font-size: 13px;
		font-weight: 600;
	}

	.board-guidance p {
		margin: 3px 0 0;
		color: var(--text-mute);
		font-size: 12px;
		line-height: 1.35;
	}

	.bin-board {
		display: grid;
		grid-template-columns: repeat(auto-fit, minmax(220px, 1fr));
		gap: 12px;
		padding: 14px 18px 18px;
		background: var(--bg-raised);
	}

	.bin-card {
		display: flex;
		flex-direction: column;
		min-height: 178px;
		min-width: 0;
		border: 1px solid var(--line);
		border-radius: var(--radius);
		background: var(--bg);
		box-shadow: var(--shadow-card);
		transition:
			border-color var(--t-fast) var(--ease),
			background var(--t-fast) var(--ease),
			box-shadow var(--t-fast) var(--ease);
	}

	.bin-card--unplaced {
		border-style: dashed;
		background: color-mix(in oklch, var(--bg) 82%, var(--bg-raised));
	}

	.bin-card--drop-target {
		border-color: color-mix(in oklch, var(--c-accent) 64%, var(--line));
		background: color-mix(in oklch, var(--c-accent) 8%, var(--bg));
		box-shadow: 0 0 0 2px color-mix(in oklch, var(--c-accent) 16%, transparent);
	}

	.bin-card-head {
		display: flex;
		align-items: flex-start;
		justify-content: space-between;
		gap: 12px;
		padding: 12px 12px 10px;
		border-bottom: 1px solid var(--line);
	}

	.bin-card-head h3 {
		margin: 0;
		font-size: 15px;
		font-weight: 600;
		letter-spacing: -0.012em;
	}

	.bin-card-head p {
		margin: 3px 0 0;
		color: var(--text-mute);
		font-size: 12px;
	}

	.bin-stack {
		display: flex;
		flex: 1;
		flex-direction: column;
		gap: 8px;
		padding: 10px;
	}

	.bin-empty {
		margin: 0;
		padding: 14px 10px;
		border: 1px dashed var(--line);
		border-radius: var(--radius-sm);
		color: var(--text-faint);
		font-size: 12px;
		text-align: center;
	}

	.tracking-empty--board {
		grid-column: 1 / -1;
		border: 1px dashed var(--line);
		border-radius: var(--radius-sm);
		background: var(--bg);
	}

	.board-card {
		display: grid;
		grid-template-columns: minmax(0, 1fr);
		gap: 8px 12px;
		padding: 10px;
		border: 1px solid var(--line);
		border-radius: var(--radius-sm);
		background: var(--bg-raised);
		cursor: grab;
		transition:
			background var(--t-fast) var(--ease),
			border-color var(--t-fast) var(--ease),
			opacity var(--t-fast) var(--ease),
			transform var(--t-fast) var(--ease);
	}

	.board-card:hover {
		background: var(--bg-high);
	}

	.board-card:active {
		cursor: grabbing;
	}

	.board-card--dragging {
		opacity: 0.52;
		transform: scale(0.985);
		border-color: color-mix(in oklch, var(--c-accent) 44%, var(--line));
	}

	.board-card-main {
		min-width: 0;
	}

	.board-card-title-row {
		display: flex;
		align-items: center;
		gap: 8px;
		min-width: 0;
	}

	.board-card p {
		margin: 3px 0 0;
	}

	.card-actions {
		justify-content: flex-end;
		align-self: start;
		gap: 4px;
		opacity: 0.72;
		transition: opacity var(--t-fast) var(--ease);
	}

	.board-card:hover .card-actions,
	.board-card:focus-within .card-actions {
		opacity: 1;
	}

	.board-card-extra,
	.move-form {
		grid-column: 1 / -1;
	}

	.move-form {
		justify-content: flex-end;
		padding-top: 2px;
	}

	.check {
		display: inline-flex;
		gap: 8px;
		align-items: center;
		margin: 0;
		font-size: 12px;
		white-space: nowrap;
	}

	.check input {
		width: auto;
	}

	.tracking-followups--priority {
		border-color: color-mix(in oklch, var(--c-accent) 26%, var(--line));
	}

	.followup-row {
		display: grid;
		grid-template-columns: minmax(0, 1fr) minmax(160px, 0.5fr) auto auto auto;
		gap: 8px;
		align-items: center;
		padding: 12px 18px;
		border-bottom: 1px solid var(--line);
	}

	.followup-row:last-child {
		border-bottom: 0;
	}

	.followup-main {
		min-width: 0;
	}

	.followup-main strong {
		font-size: 14px;
		font-weight: 600;
	}

	.followup-main p {
		margin: 2px 0 0;
	}

	@media (max-width: 900px) {
		.tracking-workspace,
		.detail-columns,
		.board-controls {
			grid-template-columns: 1fr;
		}
	}

	@media (max-width: 760px) {
		.tracking {
			padding: 20px 16px 48px;
		}

		.tracking-head {
			align-items: flex-start;
		}

		.board-card,
		.followup-row {
			grid-template-columns: 1fr;
		}

		.card-actions,
		.move-form {
			justify-content: flex-start;
		}
	}
</style>
