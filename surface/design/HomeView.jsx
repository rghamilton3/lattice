/* Home view — the default landing.
   ADHD-aware structure inspired directly by the research:
     - "Now": one primary item (last touched doc), not a list.
     - "Inbox": recent captures, fast triage actions, no guilt counter.
     - "Resurfaced": gentle "from your past" cards (dismissible, no shame).
     - "Working": open loops + most-recent working docs.
   Quiet by default. Nothing red unless it's genuinely an alarm.
*/

const { useState: useStateH } = React;

const HomeView = ({ state, setState, onOpenDoc, onCapture, onProcessMode }) => {
	const data = window.LATTICE_DATA;
	const now = data.today.getTime();
	const last = data.workingDocs[0]; // "where you were"

	const dismissed = state.dismissedCaptureIds || [];
	const visibleCaptures = data.captures.filter((c) => !dismissed.includes(c.id));
	const dismissCapture = (id, action) => {
		setState((s) => ({
			...s,
			dismissedCaptureIds: [...(s.dismissedCaptureIds || []), id],
			toast: { id: Date.now(), msg: `${action} · capture #${id}` }
		}));
		setTimeout(
			() => setState((s) => (s.toast?.msg?.endsWith(`#${id}`) ? { ...s, toast: null } : s)),
			1800
		);
	};

	return (
		<div className="home-scroll">
			<div className="home">
				{/* Greeting / posture */}
				<div className="home-greet">
					<div>
						<h1 className="home-title">Where you were</h1>
						<p className="mute home-sub">
							Pick up, or capture something new. No streaks, no overdue.
						</p>
					</div>
					<PostureToggle
						value={state.posture}
						onChange={(p) => setState((s) => ({ ...s, posture: p }))}
					/>
				</div>

				{/* NOW — one primary item */}
				<NowCard doc={last} onOpen={() => onOpenDoc({ kind: 'working', slug: last.slug })} />

				{/* INBOX + RESURFACED row */}
				<div className="home-grid">
					<section className="card home-section">
						<div className="home-section-head">
							<h2 className="section-title">
								<Icon name="inbox" size={16} />
								<span>Inbox</span>
								{state.posture !== 'quiet' && (
									<span className="count-soft">{data.captures.length}</span>
								)}
							</h2>
							<span
								className="faint"
								style={{ fontSize: 12, whiteSpace: 'nowrap', marginLeft: 12 }}
							>
								process when you feel like it
							</span>
						</div>
						<InboxList
							captures={visibleCaptures}
							now={now}
							onOpen={onOpenDoc}
							onTriage={dismissCapture}
						/>
						<div className="home-section-foot">
							<button className="btn btn-ghost">
								<Icon name="archive" size={14} /> Archive all read
							</button>
							<button className="btn btn-ghost" onClick={onProcessMode}>
								<Icon name="clock" size={14} /> Process 10 in 5 min
							</button>
						</div>
					</section>

					<section className="card home-section">
						<div className="home-section-head">
							<h2 className="section-title">
								<Icon name="sparkle" size={16} />
								<span>From your past</span>
							</h2>
							<span
								className="faint"
								style={{ fontSize: 12, whiteSpace: 'nowrap', marginLeft: 12 }}
							>
								quiet · dismissible
							</span>
						</div>
						<Resurfaced items={data.resurfaced} onOpen={onOpenDoc} />
					</section>
				</div>

				{/* WORKING */}
				<section className="card home-section">
					<div className="home-section-head">
						<h2 className="section-title">
							<Icon name="edit" size={16} />
							<span>Working docs</span>
						</h2>
						<button className="btn btn-ghost">
							<Icon name="plus" size={14} /> New doc
						</button>
					</div>
					<div className="working-grid">
						{data.workingDocs.map((d) => (
							<button
								key={d.slug}
								className="working-card"
								onClick={() => onOpenDoc({ kind: 'working', slug: d.slug })}
							>
								<div className="working-card-title">{d.title}</div>
								<div className="working-card-meta mono">
									{d.slug}.md · {relTime(d.modified_at, now)}
								</div>
								<div className="working-card-preview soft">
									{d.content
										.split('\n')
										.filter((l) => l.trim() && !l.startsWith('#'))
										.slice(0, 2)
										.join(' ')
										.slice(0, 180)}
								</div>
							</button>
						))}
					</div>
				</section>

				<div className="home-foot faint">
					Lattice · ADHD-aware substrate · captured loosely, retrieved intelligently
				</div>
			</div>
		</div>
	);
};

const NowCard = ({ doc, onOpen }) => (
	<div className="now-card card" onClick={onOpen} role="button" tabIndex={0}>
		<div className="now-card-inner">
			<div className="row" style={{ gap: 8 }}>
				<span className="chip chip-working">working</span>
				<span className="faint mono" style={{ fontSize: 12 }}>
					{doc.slug}.md
				</span>
				<span className="faint" style={{ fontSize: 12, marginLeft: 'auto', whiteSpace: 'nowrap' }}>
					you left off about 22m ago
				</span>
			</div>
			<h2 className="now-card-title">{doc.title}</h2>
			<p className="now-card-snippet soft">
				{doc.content
					.split('\n')
					.filter((l) => l.trim() && !l.startsWith('#'))
					.slice(0, 3)
					.join(' ')
					.slice(0, 260)}
				…
			</p>
			<div className="now-card-actions">
				<button className="btn btn-primary">
					<Icon name="arrow-right" size={14} /> Resume
				</button>
				<button className="btn btn-ghost">
					<Icon name="split" size={14} /> Open in split
				</button>
				<button className="btn btn-ghost">
					<Icon name="sim" size={14} /> Related
				</button>
				<span className="faint" style={{ fontSize: 12, marginLeft: 'auto' }}>
					autosaved · revision 14
				</span>
			</div>
		</div>
	</div>
);

const InboxList = ({ captures, now, onOpen, onTriage }) => {
	const [active, setActive] = useStateH(0);
	if (captures.length === 0) {
		return (
			<div className="inbox-empty soft">
				<div style={{ fontSize: 22, marginBottom: 6 }}>📭</div>
				<div style={{ fontWeight: 500 }}>Inbox is clear.</div>
				<div className="faint" style={{ fontSize: 13, marginTop: 4 }}>
					Capture something the moment you think of it — sort later, or never.
				</div>
			</div>
		);
	}
	return (
		<div className="inbox">
			{captures.slice(0, 5).map((c, i) => (
				<div
					key={c.id}
					className="inbox-row"
					data-active={i === active}
					onMouseEnter={() => setActive(i)}
					onClick={() => onOpen({ kind: 'capture', id: c.id })}
				>
					<div className="inbox-mark">
						<Icon name="circle" size={8} />
					</div>
					<div className="inbox-body">
						<div className="inbox-text">{c.text}</div>
						<div className="inbox-meta">
							<span className="chip chip-capture">capture</span>
							<span>·</span>
							<span className="mono">{c.source}</span>
							<span>·</span>
							<span>{relTime(c.captured_at, now)}</span>
						</div>
						<div className="inbox-actions" onClick={(e) => e.stopPropagation()}>
							<TriageBtn
								icon="check"
								label="Keep"
								kkey="k"
								onClick={() => onTriage(c.id, 'Kept')}
							/>
							<TriageBtn
								icon="archive"
								label="Archive"
								kkey="a"
								onClick={() => onTriage(c.id, 'Archived')}
							/>
							<TriageBtn
								icon="promote"
								label="Promote"
								kkey="p"
								onClick={() => onTriage(c.id, 'Promoted to working doc')}
							/>
							<TriageBtn
								icon="task"
								label="Task"
								kkey="t"
								onClick={() => onTriage(c.id, 'Made into a task')}
							/>
							<TriageBtn
								icon="skip"
								label="Skip"
								kkey="␣"
								onClick={() => onTriage(c.id, 'Skipped')}
							/>
						</div>
					</div>
				</div>
			))}
		</div>
	);
};

const TriageBtn = ({ icon, label, kkey, onClick }) => (
	<button className="triage-btn" title={`${label} · ${kkey}`} onClick={onClick}>
		<Icon name={icon} size={14} />
		<span className="triage-label">{label}</span>
		<span className="kbd triage-kbd">{kkey}</span>
	</button>
);

const Resurfaced = ({ items, onOpen }) => (
	<div className="resurf">
		{items.map((it, i) => (
			<div key={i} className="resurf-row">
				<div className="resurf-reason faint">
					<Icon name="clock" size={12} />
					<span>{it.reason}</span>
				</div>
				<div
					className="resurf-snippet"
					onClick={() =>
						onOpen(
							it.kind === 'capture'
								? { kind: 'capture', id: it.id }
								: { kind: 'working', slug: it.slug }
						)
					}
				>
					{it.snippet}
				</div>
				<div className="resurf-actions">
					<button className="btn btn-ghost btn-mini">
						<Icon name="check" size={12} /> Useful
					</button>
					<button className="btn btn-ghost btn-mini">Not now</button>
					<button className="btn btn-ghost btn-mini">Don’t resurface</button>
				</div>
			</div>
		))}
	</div>
);

const PostureToggle = ({ value, onChange }) => {
	const opts = [
		{ id: 'quiet', label: 'Quiet', hint: 'no counts, no nudges' },
		{ id: 'standard', label: 'Standard', hint: 'gentle nudges' },
		{ id: 'active', label: 'Active', hint: 'show counts and reviews' }
	];
	return (
		<div className="posture">
			<div className="posture-label faint">notification posture</div>
			<div className="posture-row">
				{opts.map((o) => (
					<button
						key={o.id}
						className="posture-btn"
						aria-pressed={value === o.id}
						onClick={() => onChange(o.id)}
						title={o.hint}
					>
						{o.label}
					</button>
				))}
			</div>
		</div>
	);
};

Object.assign(window, { HomeView });
