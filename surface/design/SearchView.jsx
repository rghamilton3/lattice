/* Search view — three-pane convention from the research:
   - Left: collapsible cluster facets (HDBSCAN-style, labels LLM-generated)
   - Center: result list with kind chip, score, snippet
   - (Preview lives in the right workbench pane when user opens a result)
   Recency tie-breaks; results never block on cluster hydration.
*/

const { useState: useStateS, useMemo: useMemoS } = React;

const SearchView = ({ state, setState, onOpenDoc }) => {
	const data = window.LATTICE_DATA;
	const [q, setQ] = useStateS(state.lastQuery || 'attention residue');
	const [enabledClusters, setEnabledClusters] = useStateS(
		() => new Set(data.clusters.map((c) => c.id))
	);
	const [kindFilter, setKindFilter] = useStateS(new Set(['capture', 'local-file', 'working']));
	const [recencyFirst, setRecencyFirst] = useStateS(true);

	const raw = data.searchResults[q] || data.searchResults['attention residue'];

	const filtered = useMemoS(() => {
		return raw.filter((r) => enabledClusters.has(r.cluster) && kindFilter.has(r.kind));
	}, [raw, enabledClusters, kindFilter]);

	const toggleCluster = (id) => {
		setEnabledClusters((s) => {
			const next = new Set(s);
			next.has(id) ? next.delete(id) : next.add(id);
			return next;
		});
	};
	const toggleKind = (k) => {
		setKindFilter((s) => {
			const next = new Set(s);
			next.has(k) ? next.delete(k) : next.add(k);
			return next;
		});
	};

	return (
		<div className="search-view">
			{/* search bar */}
			<div className="search-bar">
				<Icon name="search" size={16} />
				<input
					autoFocus
					className="search-input"
					value={q}
					onChange={(e) => setQ(e.target.value)}
					placeholder="What were you trying to find?"
				/>
				<span className="faint mono" style={{ fontSize: 12 }}>
					{filtered.length} of {raw.length} results
				</span>
			</div>

			<div className="search-body">
				{/* Facets */}
				<aside className="facets">
					<div className="facets-section">
						<div className="facets-head">
							<span>Clusters</span>
							<span className="faint" style={{ fontSize: 11 }}>
								HDBSCAN · labeled
							</span>
						</div>
						<div className="facets-list">
							{data.clusters.map((c) => {
								const on = enabledClusters.has(c.id);
								return (
									<button
										key={c.id}
										className="facet"
										aria-pressed={on}
										onClick={() => toggleCluster(c.id)}
									>
										<span
											className="facet-dot"
											style={{ background: c.color, opacity: on ? 1 : 0.25 }}
										/>
										<span className="facet-label">{c.label}</span>
										<span className="facet-count">{c.count}</span>
									</button>
								);
							})}
						</div>
					</div>

					<div className="facets-section">
						<div className="facets-head">
							<span>Kind</span>
						</div>
						<div className="facets-list">
							{['capture', 'local-file', 'working'].map((k) => (
								<button
									key={k}
									className="facet"
									aria-pressed={kindFilter.has(k)}
									onClick={() => toggleKind(k)}
								>
									<span className={`chip chip-${k === 'local-file' ? 'file' : k}`}>{k}</span>
								</button>
							))}
						</div>
					</div>

					<div className="facets-section">
						<div className="facets-head">
							<span>Sort</span>
						</div>
						<div className="facets-list">
							<button
								className="facet"
								aria-pressed={recencyFirst}
								onClick={() => setRecencyFirst(true)}
							>
								<Icon name="clock" size={13} /> Recency-broken
							</button>
							<button
								className="facet"
								aria-pressed={!recencyFirst}
								onClick={() => setRecencyFirst(false)}
							>
								<Icon name="sim" size={13} /> Score-only
							</button>
						</div>
					</div>

					<div className="facets-section facets-saved">
						<div className="facets-head">
							<span>Saved</span>
						</div>
						<div className="facets-list">
							<button className="facet">Active research</button>
							<button className="facet">Open questions</button>
							<button className="facet">Waiting on someone</button>
						</div>
					</div>
				</aside>

				{/* Results */}
				<section className="results">
					{filtered.length === 0 ? (
						<div className="results-empty soft">
							No matches in the clusters you have selected.
							<button
								className="btn btn-ghost"
								style={{ marginLeft: 8 }}
								onClick={() => setEnabledClusters(new Set(data.clusters.map((c) => c.id)))}
							>
								show all clusters
							</button>
						</div>
					) : (
						filtered.map((r, i) => <ResultRow key={i} r={r} onOpenDoc={onOpenDoc} />)
					)}
					{filtered.length > 0 && (
						<div className="results-foot faint" style={{ fontSize: 12 }}>
							Recency-tie-broken. {`"`}similar / mentions / nearby{`"`} live inside each opened
							result.
						</div>
					)}
				</section>
			</div>
		</div>
	);
};

const ResultRow = ({ r, onOpenDoc }) => {
	const ref =
		r.kind === 'capture'
			? { kind: 'capture', id: r.id }
			: r.kind === 'local-file'
				? { kind: 'file', id: r.id }
				: { kind: 'working', slug: r.slug };
	const title =
		r.kind === 'capture'
			? `capture #${r.id}`
			: r.kind === 'local-file'
				? r.path.split('/').pop()
				: r.slug + '.md';

	return (
		<article className="result">
			<div className="result-head">
				<span className={`chip chip-${r.kind === 'local-file' ? 'file' : r.kind}`}>{r.kind}</span>
				{r.kind === 'local-file' && (
					<span className="mono faint" style={{ fontSize: 12 }}>
						@{r.machine_id}
					</span>
				)}
				<span className="mono faint" style={{ fontSize: 12 }}>
					{title}
				</span>
				<span style={{ marginLeft: 'auto' }} className="row">
					<span className="score-bar" title={`score ${r.score.toFixed(2)}`}>
						<span className="score-fill" style={{ width: `${Math.round(r.score * 100)}%` }} />
					</span>
					<span className="mono faint" style={{ fontSize: 11, width: 36, textAlign: 'right' }}>
						{r.score.toFixed(2)}
					</span>
				</span>
			</div>
			<p className="result-snippet">{r.snippet}</p>
			<div className="result-actions">
				<button className="btn" onClick={() => onOpenDoc(ref)}>
					<Icon name="arrow-right" size={13} /> Open
				</button>
				<button className="btn btn-ghost" onClick={() => onOpenDoc(ref, 'split')}>
					<Icon name="split" size={13} /> Open in split
				</button>
				{r.kind !== 'working' && (
					<button className="btn btn-ghost">
						<Icon name="promote" size={13} /> Promote
					</button>
				)}
				<button className="btn btn-ghost">
					<Icon name="sim" size={13} /> Similar
				</button>
			</div>
		</article>
	);
};

Object.assign(window, { SearchView });
