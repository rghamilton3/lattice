/* DocView — renders either a reading pane (capture, file, working in read mode)
   or an editor pane (working in edit mode).
   Inline "Related notes" at the bottom of every reading view (the resurfacing pattern).
   Top toolbar carries lateral movement: similar / mentions / nearby — preserved from existing Surface.
*/

const { useState: useStateD, useEffect: useEffectD, useRef: useRefD } = React;

const DocView = ({ docRef, mode, onBack, onOpenDoc, onSplit, onLateral, vimMode }) => {
	const data = window.LATTICE_DATA;
	const now = data.today.getTime();
	const doc = resolveDoc(docRef, data);
	if (!doc)
		return (
			<div className="results-empty soft" style={{ padding: 32 }}>
				Document not found.
			</div>
		);

	const isEditor = mode === 'edit' && doc.kind === 'working';
	const key = docRef.kind === 'working' ? docRef.slug : 'surface-redesign';

	return (
		<div className="doc-view">
			{/* lateral toolbar */}
			<div className="doc-toolbar">
				<div className="row" style={{ gap: 4 }}>
					<button className="btn btn-ghost" onClick={onBack} title="Back to home">
						<Icon name="arrow-right" size={14} style={{ transform: 'rotate(180deg)' }} /> Back
					</button>
					<span className="faint" style={{ fontSize: 12 }}>
						·
					</span>
					<span className={`chip chip-${doc.kind === 'local-file' ? 'file' : doc.kind}`}>
						{doc.kind === 'local-file' ? 'local file' : doc.kind}
					</span>
					<span className="mono soft" style={{ fontSize: 13 }}>
						{doc.label}
					</span>
				</div>
				<div className="row" style={{ gap: 2 }}>
					<button
						className="btn btn-ghost"
						title="More like this — opens semantic neighbors in the other pane"
						onClick={() => onLateral({ kind: 'similar', key })}
					>
						<Icon name="sim" size={14} /> Similar
					</button>
					<button
						className="btn btn-ghost"
						title='Search for "attention residue" (or your selection) across all corpora'
						onClick={() => onLateral({ kind: 'mentions', key: 'attention residue' })}
					>
						<Icon name="quote" size={14} /> Mentions
					</button>
					<button
						className="btn btn-ghost"
						title="Items from ±72h around this doc"
						onClick={() => onLateral({ kind: 'nearby', key })}
					>
						<Icon name="clock" size={14} /> Nearby
					</button>
					<span className="vbar" />
					{doc.kind === 'working' && !isEditor && (
						<button className="btn btn-ghost" onClick={() => onOpenDoc(docRef, undefined, 'edit')}>
							<Icon name="edit" size={14} /> Edit
						</button>
					)}
					{doc.kind !== 'working' && (
						<button className="btn btn-ghost">
							<Icon name="promote" size={14} /> Promote
						</button>
					)}
					<button className="btn btn-ghost" onClick={() => onSplit(docRef)}>
						<Icon name="split" size={14} /> Split
					</button>
				</div>
			</div>

			{/* body */}
			<div className="doc-body">
				{isEditor ? <Editor doc={doc} vimMode={vimMode} /> : <ReadingBody doc={doc} now={now} />}
			</div>

			{/* related — only in reading mode */}
			{!isEditor && <RelatedRail docRef={docRef} onOpenDoc={onOpenDoc} />}
		</div>
	);
};

function resolveDoc(ref, data) {
	if (ref.kind === 'capture') {
		const c = data.captures.find((x) => x.id === ref.id);
		if (!c) return null;
		return {
			kind: 'capture',
			label: `capture #${c.id}`,
			title: `Capture from ${c.source} · ${new Date(c.captured_at).toLocaleString()}`,
			body: c.text,
			meta: { source: c.source, captured_at: c.captured_at, ingested_at: c.ingested_at }
		};
	}
	if (ref.kind === 'file') {
		const f = data.localFiles.find((x) => x.id === ref.id);
		if (!f) return null;
		return {
			kind: 'local-file',
			label: f.path,
			title: f.path.split('/').pop(),
			machine_id: f.machine_id,
			body: '',
			isPdf: f.mime_type === 'application/pdf',
			meta: f
		};
	}
	if (ref.kind === 'working') {
		const w = data.workingDocs.find((x) => x.slug === ref.slug);
		if (!w) return null;
		return {
			kind: 'working',
			slug: w.slug,
			label: w.slug + '.md',
			title: w.title,
			body: w.content,
			modified_at: w.modified_at
		};
	}
	return null;
}

const ReadingBody = ({ doc, now }) => {
	return (
		<div className="reading-scroll">
			<div className="reading-col">
				{/* light meta line */}
				<div className="row reading-meta">
					{doc.kind === 'capture' && (
						<>
							<span className="chip chip-capture">capture</span>
							<span className="faint">·</span>
							<span className="mono faint">{doc.meta.source}</span>
							<span className="faint">·</span>
							<span className="faint">{relTime(doc.meta.captured_at, now)}</span>
						</>
					)}
					{doc.kind === 'local-file' && (
						<>
							<span className="chip chip-file">local file</span>
							<span className="mono faint">@{doc.machine_id}</span>
							<span className="faint">·</span>
							<span className="mono faint">{doc.label}</span>
							<span className="faint">·</span>
							<span className="faint">{relTime(doc.meta.modified_at, now)}</span>
						</>
					)}
					{doc.kind === 'working' && (
						<>
							<span className="chip chip-working">working</span>
							<span className="mono faint">{doc.label}</span>
							<span className="faint">·</span>
							<span className="faint">edited {relTime(doc.modified_at, now)}</span>
						</>
					)}
				</div>

				{doc.isPdf ? (
					<div className="placeholder-img" style={{ width: '100%', height: 520 }}>
						PDF preview · papers/leroy-2009-attention-residue.pdf
					</div>
				) : doc.kind === 'capture' ? (
					<div className="capture-body prose">
						<p>{doc.body}</p>
					</div>
				) : (
					<ProseMarkdown content={doc.body} />
				)}
			</div>
		</div>
	);
};

const RelatedRail = ({ docRef, onOpenDoc }) => {
	const data = window.LATTICE_DATA;
	const key = docRef.kind === 'working' ? docRef.slug : null;
	const list = (key && data.related[key]) || [
		{
			kind: 'capture',
			id: 410,
			snippet: 'greyscale baseline w/ semantic color only — alarm/caution/info/ok.'
		},
		{
			kind: 'local-file',
			id: 41,
			snippet: 'Leroy 2009 — attention residue from unfinished tasks.',
			machine_id: 'personal-laptop'
		},
		{
			kind: 'working',
			slug: 'qmd-tuning-log',
			snippet: 'recording every parameter pass against my actual corpus.'
		}
	];
	return (
		<div className="related-rail">
			<div className="related-head">
				<span className="related-title">Related notes</span>
				<span className="faint" style={{ fontSize: 12 }}>
					semantic neighbors · QMD cosine
				</span>
			</div>
			<div className="related-list">
				{list.map((r, i) => {
					const ref =
						r.kind === 'capture'
							? { kind: 'capture', id: r.id }
							: r.kind === 'local-file'
								? { kind: 'file', id: r.id }
								: { kind: 'working', slug: r.slug };
					return (
						<button key={i} className="related-card" onClick={() => onOpenDoc(ref)}>
							<div className="row" style={{ gap: 6 }}>
								<span className={`chip chip-${r.kind === 'local-file' ? 'file' : r.kind}`}>
									{r.kind}
								</span>
								{r.machine_id && (
									<span className="mono faint" style={{ fontSize: 11 }}>
										@{r.machine_id}
									</span>
								)}
							</div>
							<div className="related-snippet soft">{r.snippet}</div>
						</button>
					);
				})}
			</div>
		</div>
	);
};

const ProseMarkdown = ({ content }) => {
	// Tiny renderer — enough to make markdown look right for the prototype.
	const lines = content.split('\n');
	const out = [];
	let listBuf = null;
	const flushList = () => {
		if (listBuf) {
			out.push(
				<ul key={'ul' + out.length}>
					{listBuf.map((l, i) => (
						<li key={i}>{inline(l)}</li>
					))}
				</ul>
			);
			listBuf = null;
		}
	};
	function inline(s) {
		// Bold **text**, code `text`
		const parts = [];
		let rest = s;
		let key = 0;
		while (rest.length) {
			const b = rest.match(/^\*\*(.+?)\*\*/);
			const c = rest.match(/^`(.+?)`/);
			if (b) {
				parts.push(<strong key={key++}>{b[1]}</strong>);
				rest = rest.slice(b[0].length);
			} else if (c) {
				parts.push(<code key={key++}>{c[1]}</code>);
				rest = rest.slice(c[0].length);
			} else {
				parts.push(rest[0]);
				rest = rest.slice(1);
			}
		}
		return parts;
	}
	lines.forEach((line, i) => {
		if (line.startsWith('# ')) {
			flushList();
			out.push(<h1 key={i}>{line.slice(2)}</h1>);
		} else if (line.startsWith('## ')) {
			flushList();
			out.push(<h2 key={i}>{line.slice(3)}</h2>);
		} else if (line.startsWith('### ')) {
			flushList();
			out.push(<h3 key={i}>{line.slice(4)}</h3>);
		} else if (line.match(/^[-*] /)) {
			listBuf = listBuf || [];
			listBuf.push(line.replace(/^[-*] /, ''));
		} else if (line.trim() === '') {
			flushList();
		} else {
			flushList();
			out.push(<p key={i}>{inline(line)}</p>);
		}
	});
	flushList();
	return <div className="prose">{out}</div>;
};

/* Editor — fake CodeMirror look, mono font, line numbers, save-state indicator. */
const Editor = ({ doc, vimMode }) => {
	const [body, setBody] = useStateD(doc.body);
	const [dirty, setDirty] = useStateD(false);
	const [saved, setSaved] = useStateD(true);
	const timerRef = useRefD(null);

	useEffectD(() => {
		setBody(doc.body);
		setDirty(false);
		setSaved(true);
	}, [doc.slug]);

	const onChange = (v) => {
		setBody(v);
		setDirty(true);
		setSaved(false);
		if (timerRef.current) clearTimeout(timerRef.current);
		timerRef.current = setTimeout(() => {
			setDirty(false);
			setSaved(true);
		}, 1100);
	};

	const lineCount = body.split('\n').length;

	return (
		<div className="editor-shell">
			<div className="editor-status">
				<span className="mono faint" style={{ fontSize: 12 }}>
					{doc.label}
				</span>
				{dirty ? (
					<span className="mute" style={{ fontSize: 12 }}>
						· unsaved
					</span>
				) : saved ? (
					<span style={{ fontSize: 12, color: 'var(--c-ok)' }}>· saved</span>
				) : null}
				<span style={{ marginLeft: 'auto' }} className="row">
					<span className="kbd">:w</span>
					<span className="faint" style={{ fontSize: 12 }}>
						· vim {vimMode ? 'on' : 'off'}
					</span>
				</span>
			</div>
			<div className="editor-body">
				<pre className="editor-lines mono" aria-hidden>
					{Array.from({ length: lineCount }, (_, i) => i + 1).join('\n')}
				</pre>
				<textarea
					className="editor-area mono"
					value={body}
					onChange={(e) => onChange(e.target.value)}
					spellCheck={false}
				/>
			</div>
		</div>
	);
};

/* Lateral results pane — shown when user clicks Similar / Mentions / Nearby. */
const LateralResults = ({ source, onOpenDoc, onBack }) => {
	const data = window.LATTICE_DATA;
	const payload =
		source.kind === 'similar'
			? data.lateral.similar[source.key]
			: source.kind === 'mentions'
				? data.lateral.mentions[source.key]
				: source.kind === 'nearby'
					? data.lateral.nearby[source.key]
					: null;

	if (!payload) {
		return (
			<div style={{ padding: 24 }} className="soft">
				No lateral results.
			</div>
		);
	}

	const icon = source.kind === 'similar' ? 'sim' : source.kind === 'mentions' ? 'quote' : 'clock';

	return (
		<div className="doc-view">
			<div className="doc-toolbar">
				<div className="row" style={{ gap: 4 }}>
					{onBack && (
						<button className="btn btn-ghost" onClick={onBack}>
							<Icon name="arrow-right" size={14} style={{ transform: 'rotate(180deg)' }} /> Back
						</button>
					)}
					<span className="faint" style={{ fontSize: 12 }}>
						·
					</span>
					<Icon name={icon} size={14} />
					<span className="soft" style={{ fontSize: 13 }}>
						{payload.title}
					</span>
				</div>
			</div>
			<div className="doc-body lateral-body">
				<div className="lateral-head">
					<span className="faint mono" style={{ fontSize: 12 }}>
						{payload.sub}
					</span>
					<span className="faint" style={{ fontSize: 12, marginLeft: 'auto' }}>
						{payload.results.length} results
					</span>
				</div>
				<div className="results lateral-results">
					{payload.results.map((r, i) => (
						<ResultRowLite
							key={i}
							r={r}
							onOpenDoc={onOpenDoc}
							highlight={source.kind === 'mentions' ? source.key : null}
						/>
					))}
				</div>
			</div>
		</div>
	);
};

const ResultRowLite = ({ r, onOpenDoc, highlight }) => {
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

	// Highlight matched phrase inline for "mentions"
	const renderSnippet = () => {
		if (!highlight) return r.snippet;
		const re = new RegExp(`(${highlight.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')})`, 'i');
		const parts = r.snippet.split(re);
		return parts.map((p, i) =>
			re.test(p) ? (
				<mark key={i} className="hit">
					{p}
				</mark>
			) : (
				p
			)
		);
	};

	return (
		<article className="result" onClick={() => onOpenDoc(ref)}>
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
				{r.score > 0 && (
					<span style={{ marginLeft: 'auto' }} className="row">
						<span className="score-bar">
							<span className="score-fill" style={{ width: `${Math.round(r.score * 100)}%` }} />
						</span>
						<span className="mono faint" style={{ fontSize: 11, width: 36, textAlign: 'right' }}>
							{r.score.toFixed(2)}
						</span>
					</span>
				)}
			</div>
			<p className="result-snippet">{renderSnippet()}</p>
		</article>
	);
};

Object.assign(window, { DocView, LateralResults });
