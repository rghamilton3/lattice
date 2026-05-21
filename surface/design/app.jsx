/* Top-level app — assembles Shell + views + overlays + tweaks.
   ADHD-aware touches glued together here:
   - Global keyboard shortcuts: ⌘N capture, ⌘K palette, ⌘. focus, Esc close overlays.
   - Persistence: workspace state in localStorage so reload restores the user's place.
   - Two-pane workbench preserved from existing Lattice Surface.
*/

const { useState, useEffect, useCallback, useMemo } = React;

const TWEAK_DEFAULTS = /*EDITMODE-BEGIN*/ {
	theme: 'light',
	density: 'comfortable',
	font: 'Inter',
	posture: 'quiet',
	vimMode: true,
	showFederation: true
}; /*EDITMODE-END*/

const LATTICE_INITIAL = {
	// Theme/UX
	theme: TWEAK_DEFAULTS.theme,
	density: TWEAK_DEFAULTS.density,
	font: TWEAK_DEFAULTS.font,
	posture: TWEAK_DEFAULTS.posture,
	vimMode: TWEAK_DEFAULTS.vimMode,
	// App state
	view: 'home', // 'home' | 'search' | 'doc'
	focusMode: false,
	settingsOpen: false,
	triageMode: false,
	dismissedCaptureIds: [],
	// Workbench
	panes: [{ kind: 'home' }], // 1 or 2 panes
	focusedPane: 0,
	lastQuery: 'attention residue',
	// Overlays
	captureOpen: false,
	paletteOpen: false,
	// Toast queue
	toast: null
};

function App() {
	const [s, set] = useState(() => {
		try {
			const saved = JSON.parse(localStorage.getItem('lattice.session') || 'null');
			return saved
				? { ...LATTICE_INITIAL, ...saved, captureOpen: false, paletteOpen: false, toast: null }
				: LATTICE_INITIAL;
		} catch {
			return LATTICE_INITIAL;
		}
	});

	// Apply theme + density + font to <html>
	useEffect(() => {
		document.documentElement.dataset.theme = s.theme;
		document.documentElement.dataset.density = s.density;
		document.documentElement.style.setProperty(
			'--font-ui',
			`'${s.font}', ui-sans-serif, system-ui, sans-serif`
		);
		document.documentElement.style.setProperty(
			'--font-reading',
			`'${s.font}', ui-sans-serif, system-ui, sans-serif`
		);
	}, [s.theme, s.density, s.font]);

	// Persist
	useEffect(() => {
		const { captureOpen, paletteOpen, toast, settingsOpen, ...persist } = s;
		localStorage.setItem('lattice.session', JSON.stringify(persist));
	}, [s]);

	// Global keyboard shortcuts. We can only intercept keys the browser doesn't reserve:
	// ⌘N (new window) and ⌘T (new tab) are off-limits.
	useEffect(() => {
		const inField = (e) => {
			const t = e.target;
			return t && (t.tagName === 'INPUT' || t.tagName === 'TEXTAREA' || t.isContentEditable);
		};
		const h = (e) => {
			const meta = e.metaKey || e.ctrlKey;
			if (meta && e.key.toLowerCase() === 'j' && !e.shiftKey) {
				e.preventDefault();
				set((p) => ({ ...p, captureOpen: true }));
			} else if (meta && e.key.toLowerCase() === 'j' && e.shiftKey) {
				e.preventDefault();
				newWorkingDoc();
			} else if (meta && e.key.toLowerCase() === 'k') {
				e.preventDefault();
				set((p) => ({ ...p, paletteOpen: true }));
			} else if (meta && e.key === '.') {
				e.preventDefault();
				set((p) => ({ ...p, focusMode: !p.focusMode }));
			} else if (meta && e.key === '/') {
				e.preventDefault();
				set((p) => ({ ...p, view: 'search', panes: [{ kind: 'search' }], focusedPane: 0 }));
			} else if (e.key === 'Escape') {
				set((p) => ({ ...p, captureOpen: false, paletteOpen: false, settingsOpen: false }));
			} else if (e.ctrlKey && e.altKey && e.key.toLowerCase() === 'v') {
				e.preventDefault();
				set((p) => ({ ...p, vimMode: !p.vimMode }));
			} else if (!meta && !inField(e) && e.key.toLowerCase() === 'c' && !e.shiftKey && !e.altKey) {
				// single-letter "c" capture, like Linear / Gmail — only when no field is focused
				e.preventDefault();
				set((p) => ({ ...p, captureOpen: true }));
			}
		};
		window.addEventListener('keydown', h);
		return () => window.removeEventListener('keydown', h);
	}, []);

	const toast = useCallback((msg) => {
		set((p) => ({ ...p, toast: { id: Date.now(), msg } }));
		setTimeout(() => set((p) => (p.toast?.msg === msg ? { ...p, toast: null } : p)), 2600);
	}, []);

	const openDoc = (ref, where, mode) => {
		const pane = { kind: 'doc', ref, mode: mode || 'read' };
		set((p) => {
			if (where === 'split') {
				return { ...p, view: 'doc', panes: [p.panes[0] || { kind: 'home' }, pane], focusedPane: 1 };
			}
			// open in current focused pane; if home/single, replace
			const next = [...p.panes];
			next[p.focusedPane] = pane;
			return { ...p, view: 'doc', panes: next };
		});
	};

	const openInOther = (ref) => openDoc(ref, 'split');

	const closeRight = () => set((p) => ({ ...p, panes: [p.panes[0]], focusedPane: 0 }));

	const newWorkingDoc = () => {
		toast('New working doc created (mock) · ⌘⇧N');
	};

	const onCommand = (a) => {
		if (a.type === 'capture') set((p) => ({ ...p, captureOpen: true }));
		else if (a.type === 'view')
			set((p) => ({ ...p, view: a.view, panes: [{ kind: a.view }], focusedPane: 0 }));
		else if (a.type === 'open') openDoc(a.ref);
		else if (a.type === 'new-doc') newWorkingDoc();
		else if (a.type === 'toggle-focus') set((p) => ({ ...p, focusMode: !p.focusMode }));
		else if (a.type === 'toggle-vim') set((p) => ({ ...p, vimMode: !p.vimMode }));
		else if (a.type === 'open-settings') set((p) => ({ ...p, settingsOpen: true }));
	};

	const openLateral = (paneIndex, source) => {
		const other = paneIndex === 0 ? 1 : 0;
		const content = { kind: 'results', source };
		set((p) => {
			if (p.panes.length === 1) {
				// Open as split — keep current pane on left, results on right
				return { ...p, panes: [p.panes[0], content], focusedPane: 1, view: 'doc' };
			}
			const next = [...p.panes];
			next[other] = content;
			return { ...p, panes: next, focusedPane: other, view: 'doc' };
		});
	};

	const renderPane = (paneIndex) => {
		const p = s.panes[paneIndex];
		if (!p) return null;
		if (p.kind === 'home') {
			return (
				<HomeView
					state={s}
					setState={set}
					onOpenDoc={openDoc}
					onCapture={() => set((x) => ({ ...x, captureOpen: true }))}
					onProcessMode={() => set((x) => ({ ...x, triageMode: true }))}
				/>
			);
		}
		if (p.kind === 'search') {
			return <SearchView state={s} setState={set} onOpenDoc={openDoc} />;
		}
		if (p.kind === 'results') {
			return <LateralResults source={p.source} onOpenDoc={openDoc} onBack={() => closeRight()} />;
		}
		if (p.kind === 'doc') {
			return (
				<DocView
					docRef={p.ref}
					mode={p.mode}
					vimMode={s.vimMode}
					onBack={() =>
						set((x) => ({ ...x, view: 'home', panes: [{ kind: 'home' }], focusedPane: 0 }))
					}
					onOpenDoc={openDoc}
					onSplit={(ref) => openDoc(ref, 'split')}
					onLateral={(src) => openLateral(paneIndex, src)}
				/>
			);
		}
		return null;
	};

	// Update top-level view based on focused pane content for breadcrumb correctness
	const split = s.panes.length === 2;

	return (
		<Shell
			state={s}
			setState={set}
			onCapture={() => set((p) => ({ ...p, captureOpen: true }))}
			onCommand={() => set((p) => ({ ...p, paletteOpen: true }))}
			onNav={(view) => set((p) => ({ ...p, view, panes: [{ kind: view }], focusedPane: 0 }))}
		>
			{/* Workbench: 1 or 2 panes — or full-bleed triage mode */}
			{s.triageMode ? (
				<ProcessMode
					captures={(window.LATTICE_DATA.captures || []).filter(
						(c) => !s.dismissedCaptureIds.includes(c.id)
					)}
					onExit={(decisions) => {
						const ids = decisions.map((d) => d.id);
						set((p) => ({
							...p,
							triageMode: false,
							dismissedCaptureIds: [...p.dismissedCaptureIds, ...ids],
							toast: decisions.length
								? { id: Date.now(), msg: `${decisions.length} processed · returned to home` }
								: null
						}));
						if (decisions.length) {
							setTimeout(
								() => set((p) => (p.toast?.id === Date.now() ? { ...p, toast: null } : p)),
								2200
							);
						}
					}}
				/>
			) : (
				<div className="workbench">
					<div className="workbench-row">
						<div
							className="workbench-pane"
							style={{ flex: split ? '1 1 50%' : '1 1 100%' }}
							data-focused={s.focusedPane === 0}
							onClick={() => set((p) => ({ ...p, focusedPane: 0 }))}
						>
							{renderPane(0)}
						</div>
						{split && (
							<div
								className="workbench-pane workbench-pane-right"
								style={{ flex: '1 1 50%' }}
								data-focused={s.focusedPane === 1}
								onClick={() => set((p) => ({ ...p, focusedPane: 1 }))}
							>
								<button
									className="close-pane"
									onClick={(e) => {
										e.stopPropagation();
										closeRight();
									}}
									aria-label="Close right pane"
									title="Close right pane"
								>
									<Icon name="x" size={14} />
								</button>
								{renderPane(1)}
							</div>
						)}
					</div>
				</div>
			)}

			<QuickCapture
				open={s.captureOpen}
				onClose={() => set((p) => ({ ...p, captureOpen: false }))}
				onSave={(c) => toast(`Captured · "${c.text.slice(0, 40)}${c.text.length > 40 ? '…' : ''}"`)}
			/>
			<CommandPalette
				open={s.paletteOpen}
				onClose={() => set((p) => ({ ...p, paletteOpen: false }))}
				onAction={onCommand}
			/>
			<Settings
				open={s.settingsOpen}
				onClose={() => set((p) => ({ ...p, settingsOpen: false }))}
				state={s}
				setState={set}
			/>

			{s.toast && (
				<div className="toast soft-in" role="status">
					<Icon name="check" size={14} />
					<span>{s.toast.msg}</span>
				</div>
			)}
		</Shell>
	);
}

ReactDOM.createRoot(document.getElementById('root')).render(<App />);
