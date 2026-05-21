/* Process-10-in-5-min focused triage mode.
   ADHD-aware pattern from the research:
   - One item at a time, not a list
   - Generous typography
   - 5 calm actions, single-key
   - "Stop anytime" affordance everywhere; no shame
   - A gentle, not-pressuring timer at the top (descending), pausable
   - Progress as "3 of 10" not as a streak
*/

const { useState: useStateT, useEffect: useEffectT, useRef: useRefT } = React;

const ProcessMode = ({ onExit, onPromoteToDoc, onArchive, onTask, captures }) => {
	// Use first 10 captures (or all if fewer)
	const queue = captures.slice(0, 10);
	const [i, setI] = useStateT(0);
	const [done, setDone] = useStateT(0);
	const [paused, setPaused] = useStateT(false);
	const [secondsLeft, setSecondsLeft] = useStateT(5 * 60);
	const [decisions, setDecisions] = useStateT([]);
	const data = window.LATTICE_DATA;
	const now = data.today.getTime();

	// Calm timer
	useEffectT(() => {
		if (paused) return;
		const t = setInterval(() => {
			setSecondsLeft((s) => Math.max(0, s - 1));
		}, 1000);
		return () => clearInterval(t);
	}, [paused]);

	const finished = i >= queue.length || secondsLeft === 0;

	const advance = (action) => {
		const cap = queue[i];
		setDecisions((d) => [...d, { id: cap.id, action }]);
		setDone((d) => d + 1);
		setI((x) => x + 1);
	};

	// Keyboard shortcuts for triage
	useEffectT(() => {
		const h = (e) => {
			if (finished) {
				if (e.key === 'Escape') onExit(decisions);
				return;
			}
			if (e.key === 'k' || e.key === 'K') {
				e.preventDefault();
				advance('Kept');
			} else if (e.key === 'a' || e.key === 'A') {
				e.preventDefault();
				advance('Archived');
			} else if (e.key === 'p' || e.key === 'P') {
				e.preventDefault();
				advance('Promoted');
			} else if (e.key === 't' || e.key === 'T') {
				e.preventDefault();
				advance('Made task');
			} else if (e.key === ' ') {
				e.preventDefault();
				advance('Skipped');
			} else if (e.key === 'Escape') {
				onExit(decisions);
			}
		};
		window.addEventListener('keydown', h);
		return () => window.removeEventListener('keydown', h);
	}, [i, finished, decisions]);

	const mm = Math.floor(secondsLeft / 60);
	const ss = (secondsLeft % 60).toString().padStart(2, '0');
	const pct = queue.length === 0 ? 0 : Math.min(100, (done / queue.length) * 100);

	return (
		<div className="process-mode">
			{/* gentle header */}
			<header className="process-head">
				<div className="row" style={{ gap: 10 }}>
					<Icon name="clock" size={14} />
					<span style={{ fontWeight: 500 }}>Process 10 in 5 min</span>
					<span className="faint" style={{ fontSize: 13 }}>
						· you can stop anytime
					</span>
				</div>
				<div className="row" style={{ gap: 12 }}>
					<span className="process-progress mono">
						{Math.min(done + 1, queue.length)} of {queue.length}
					</span>
					<button
						className="btn btn-ghost"
						onClick={() => setPaused((p) => !p)}
						title="Pause timer"
					>
						{paused ? '▶' : '⏸'}{' '}
						<span className="mono" style={{ width: 40, textAlign: 'right' }}>
							{mm}:{ss}
						</span>
					</button>
					<button className="btn btn-ghost" onClick={() => onExit(decisions)}>
						<Icon name="x" size={14} /> Stop
					</button>
				</div>
			</header>

			{/* progress bar */}
			<div className="process-bar">
				<div className="process-fill" style={{ width: pct + '%' }} />
			</div>

			{/* body */}
			<div className="process-body">
				{finished ? (
					<DoneCard decisions={decisions} onExit={onExit} />
				) : (
					<CaptureCard cap={queue[i]} now={now} index={i} total={queue.length} advance={advance} />
				)}
			</div>
		</div>
	);
};

const CaptureCard = ({ cap, now, index, total, advance }) => (
	<div className="cap-card">
		<div className="cap-card-meta faint">
			<span className="chip chip-capture">capture</span>
			<span>·</span>
			<span className="mono">{cap.source}</span>
			<span>·</span>
			<span>{relTime(cap.captured_at, now)}</span>
			<span style={{ marginLeft: 'auto' }} className="mono">
				#{cap.id}
			</span>
		</div>
		<p className="cap-card-body">{cap.text}</p>
		<div className="cap-card-actions">
			<CapAction
				icon="check"
				label="Keep"
				kbd="k"
				hint="leave it where it is"
				onClick={() => advance('Kept')}
			/>
			<CapAction
				icon="archive"
				label="Archive"
				kbd="a"
				hint="out of sight, still searchable"
				onClick={() => advance('Archived')}
			/>
			<CapAction
				icon="promote"
				label="Promote"
				kbd="p"
				hint="become a working doc"
				onClick={() => advance('Promoted')}
			/>
			<CapAction
				icon="task"
				label="Task"
				kbd="t"
				hint="route to your task channel"
				onClick={() => advance('Made task')}
			/>
			<CapAction
				icon="skip"
				label="Skip"
				kbd="␣"
				hint="decide later, no penalty"
				onClick={() => advance('Skipped')}
			/>
		</div>
		<p className="cap-card-foot faint">
			no shame mechanics. ambiguous? skip it. tired? close this — your queue waits.
		</p>
	</div>
);

const CapAction = ({ icon, label, kbd, hint, onClick }) => (
	<button className="cap-action" onClick={onClick}>
		<div className="cap-action-key">
			<span className="kbd">{kbd}</span>
		</div>
		<div className="cap-action-label">
			<Icon name={icon} size={15} />
			<span>{label}</span>
		</div>
		<div className="cap-action-hint faint">{hint}</div>
	</button>
);

const DoneCard = ({ decisions, onExit }) => {
	const counts = decisions.reduce((acc, d) => {
		acc[d.action] = (acc[d.action] || 0) + 1;
		return acc;
	}, {});
	return (
		<div className="cap-card done-card">
			<div style={{ fontSize: 30 }}>✓</div>
			<h2 style={{ fontSize: 22, margin: '6px 0 6px' }}>Inbox processed.</h2>
			<p className="faint" style={{ fontSize: 14, margin: 0 }}>
				{decisions.length} {decisions.length === 1 ? 'capture' : 'captures'} triaged. Whatever you
				didn't reach is still in your inbox — no penalty.
			</p>
			<div className="done-summary">
				{Object.entries(counts).map(([k, v]) => (
					<div key={k} className="done-row">
						<span className="mono faint">{v}</span>
						<span>{k}</span>
					</div>
				))}
			</div>
			<div className="row" style={{ gap: 8, marginTop: 18 }}>
				<button className="btn btn-primary" onClick={() => onExit(decisions)}>
					Back to home
				</button>
			</div>
		</div>
	);
};

Object.assign(window, { ProcessMode });
