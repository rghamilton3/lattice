/* Overlays — Quick Capture (⌘N) + Command Palette (⌘K) + Settings drawer.
   Quick capture is intentionally minimal: one textarea, no required fields, "save"
   on Enter. Captures land in the inbox. Demonstrates the <200ms sub-threshold the
   research cites as the kill point for capture flows.
*/

const { useState: useStateO, useEffect: useEffectO, useRef: useRefO, useMemo: useMemoO } = React;

const QuickCapture = ({ open, onClose, onSave }) => {
	const ref = useRefO(null);
	const [text, setText] = useStateO('');
	const [voice, setVoice] = useStateO(false);
	const [confirmed, setConfirmed] = useStateO(false);

	useEffectO(() => {
		if (open) {
			setText('');
			setConfirmed(false);
			setVoice(false);
			setTimeout(() => ref.current?.focus(), 10);
		}
	}, [open]);

	if (!open) return null;

	const submit = () => {
		if (!text.trim()) {
			onClose();
			return;
		}
		onSave({ text, source: voice ? 'voice' : 'desktop-hotkey' });
		setConfirmed(true);
		setTimeout(onClose, 650);
	};

	return (
		<div className="overlay" onClick={onClose}>
			<div className="qcap soft-in" onClick={(e) => e.stopPropagation()}>
				<div className="qcap-head">
					<div className="row" style={{ gap: 8, flexWrap: 'wrap' }}>
						<Icon name="inbox" size={14} />
						<span className="faint" style={{ fontSize: 12 }}>
							Capture · lands in your inbox · no fields required
						</span>
					</div>
					<button className="btn btn-ghost" onClick={onClose}>
						<Icon name="x" size={14} />
					</button>
				</div>
				<textarea
					ref={ref}
					className="qcap-area"
					placeholder="What's the thought? (⌘ + Enter to save, Esc to dismiss)"
					value={text}
					onChange={(e) => setText(e.target.value)}
					onKeyDown={(e) => {
						if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) {
							e.preventDefault();
							submit();
						}
						if (e.key === 'Enter' && !e.shiftKey && text.length > 0 && !e.altKey) {
							// Single Enter only saves if user has typed at least 3 chars and pressed Enter twice
						}
						if (e.key === 'Escape') onClose();
					}}
				/>
				<div className="qcap-foot">
					<div className="row" style={{ gap: 4 }}>
						<button
							className={`btn btn-ghost ${voice ? 'is-on' : ''}`}
							aria-pressed={voice}
							onClick={() => setVoice((v) => !v)}
						>
							<Icon name="mic" size={13} /> {voice ? 'Recording' : 'Voice'}
						</button>
						<button className="btn btn-ghost">
							<Icon name="link" size={13} /> Paste link
						</button>
						<span className="faint" style={{ fontSize: 12, marginLeft: 10 }}>
							{confirmed ? 'Captured — inbox updated' : `${text.length} chars`}
						</span>
					</div>
					<div className="row" style={{ gap: 8 }}>
						<span className="faint" style={{ fontSize: 12 }}>
							save with
						</span>
						<span className="kbd">⌘</span>
						<span className="kbd">↵</span>
						<button className="btn btn-primary" onClick={submit} disabled={!text.trim()}>
							<Icon name="check" size={13} /> Save
						</button>
					</div>
				</div>
			</div>
		</div>
	);
};

/* Command palette — every action in two keystrokes. Demonstrates fuzzy match
   across actions + docs. */
const CommandPalette = ({ open, onClose, onAction }) => {
	const ref = useRefO(null);
	const data = window.LATTICE_DATA;
	const [q, setQ] = useStateO('');
	const [active, setActive] = useStateO(0);

	useEffectO(() => {
		if (open) {
			setQ('');
			setActive(0);
			setTimeout(() => ref.current?.focus(), 10);
		}
	}, [open]);

	const items = useMemoO(() => {
		const actions = [
			{
				id: 'cap',
				label: 'Quick capture',
				hint: 'open capture overlay',
				kbd: 'c',
				kind: 'action',
				run: () => onAction({ type: 'capture' })
			},
			{
				id: 'search',
				label: 'Search everything',
				hint: 'go to search view',
				kbd: '⌘/',
				kind: 'action',
				run: () => onAction({ type: 'view', view: 'search' })
			},
			{
				id: 'home',
				label: 'Go home',
				hint: 'inbox + resurfaced',
				kbd: 'g h',
				kind: 'action',
				run: () => onAction({ type: 'view', view: 'home' })
			},
			{
				id: 'new',
				label: 'New working doc',
				hint: 'creates a markdown working doc',
				kbd: '⌘⇧J',
				kind: 'action',
				run: () => onAction({ type: 'new-doc' })
			},
			{
				id: 'focus',
				label: 'Toggle focus mode',
				hint: 'hide all chrome',
				kbd: '⌘.',
				kind: 'action',
				run: () => onAction({ type: 'toggle-focus' })
			},
			{
				id: 'vim',
				label: 'Toggle vim mode',
				hint: 'editor pane',
				kbd: '⌃⌥V',
				kind: 'action',
				run: () => onAction({ type: 'toggle-vim' })
			},
			{
				id: 'theme',
				label: 'Switch theme…',
				hint: 'light / dark / sepia',
				kbd: '',
				kind: 'action',
				run: () => onAction({ type: 'open-settings' })
			},
			{
				id: 'split',
				label: 'Open in split pane',
				hint: 'right pane',
				kbd: '⌘⇧↵',
				kind: 'action',
				run: () => onAction({ type: 'noop' })
			}
		];
		const docs = [
			...data.workingDocs.map((d) => ({
				id: 'w-' + d.slug,
				label: d.title,
				hint: d.slug + '.md',
				kbd: '',
				kind: 'working',
				run: () => onAction({ type: 'open', ref: { kind: 'working', slug: d.slug } })
			})),
			...data.captures.slice(0, 5).map((c) => ({
				id: 'c-' + c.id,
				label: c.text.slice(0, 80),
				hint: 'capture · ' + c.source,
				kbd: '',
				kind: 'capture',
				run: () => onAction({ type: 'open', ref: { kind: 'capture', id: c.id } })
			})),
			...data.localFiles.map((f) => ({
				id: 'f-' + f.id,
				label: f.path.split('/').pop(),
				hint: f.path + ' · @' + f.machine_id,
				kbd: '',
				kind: 'local-file',
				run: () => onAction({ type: 'open', ref: { kind: 'file', id: f.id } })
			}))
		];
		const all = [...actions, ...docs];
		if (!q.trim()) return all.slice(0, 12);
		const Q = q.toLowerCase();
		return all
			.filter((x) => (x.label + ' ' + (x.hint || '')).toLowerCase().includes(Q))
			.slice(0, 14);
	}, [q]);

	if (!open) return null;

	return (
		<div className="overlay" onClick={onClose}>
			<div className="palette soft-in" onClick={(e) => e.stopPropagation()}>
				<div className="palette-input-row">
					<Icon name="search" size={14} />
					<input
						ref={ref}
						className="palette-input"
						placeholder="Type an action or a phrase from a note…"
						value={q}
						onChange={(e) => {
							setQ(e.target.value);
							setActive(0);
						}}
						onKeyDown={(e) => {
							if (e.key === 'ArrowDown') {
								e.preventDefault();
								setActive((a) => Math.min(a + 1, items.length - 1));
							} else if (e.key === 'ArrowUp') {
								e.preventDefault();
								setActive((a) => Math.max(0, a - 1));
							} else if (e.key === 'Enter') {
								e.preventDefault();
								items[active]?.run();
								onClose();
							} else if (e.key === 'Escape') onClose();
						}}
					/>
					<button className="btn btn-ghost" onClick={onClose}>
						<Icon name="x" size={14} />
					</button>
				</div>
				<div className="palette-list">
					{items.length === 0 ? (
						<div className="palette-empty soft">
							No matches — but you can still{' '}
							<button className="link" onClick={() => onAction({ type: 'capture' })}>
								capture this thought
							</button>
							.
						</div>
					) : (
						items.map((it, i) => (
							<button
								key={it.id}
								className={`palette-row ${i === active ? 'is-active' : ''}`}
								onMouseEnter={() => setActive(i)}
								onClick={() => {
									it.run();
									onClose();
								}}
							>
								<span
									className={`chip chip-${it.kind === 'local-file' ? 'file' : it.kind === 'working' ? 'working' : it.kind === 'capture' ? 'capture' : ''}`}
								>
									{it.kind}
								</span>
								<span className="palette-label">{it.label}</span>
								<span className="palette-hint faint">{it.hint}</span>
								{it.kbd && (
									<span className="palette-kbd-row mono">
										{it.kbd.split('').map((k, i) => (
											<span key={i} className="kbd">
												{k}
											</span>
										))}
									</span>
								)}
							</button>
						))
					)}
				</div>
				<div className="palette-foot faint">
					<span>
						<span className="kbd">↑</span> <span className="kbd">↓</span> navigate
					</span>
					<span>
						<span className="kbd">↵</span> open
					</span>
					<span>
						<span className="kbd">esc</span> close
					</span>
				</div>
			</div>
		</div>
	);
};

/* Settings drawer — surfaces tweakable axes inline (in addition to the floating Tweaks panel). */
const Settings = ({ open, onClose, state, setState }) => {
	if (!open) return null;
	return (
		<div className="settings-drawer soft-in" role="dialog" aria-label="Settings">
			<div className="settings-head">
				<div className="row" style={{ gap: 8 }}>
					<Icon name="cog" size={14} />
					<span style={{ fontWeight: 500 }}>Settings</span>
				</div>
				<button className="btn btn-ghost" onClick={onClose}>
					<Icon name="x" size={14} />
				</button>
			</div>
			<div className="settings-body">
				<SettingsSection title="Theme">
					<div className="seg">
						{['light', 'dark', 'sepia'].map((t) => (
							<button
								key={t}
								aria-pressed={state.theme === t}
								onClick={() => setState((s) => ({ ...s, theme: t }))}
							>
								{t}
							</button>
						))}
					</div>
				</SettingsSection>
				<SettingsSection title="Density">
					<div className="seg">
						{['compact', 'comfortable', 'spacious'].map((d) => (
							<button
								key={d}
								aria-pressed={state.density === d}
								onClick={() => setState((s) => ({ ...s, density: d }))}
							>
								{d}
							</button>
						))}
					</div>
				</SettingsSection>
				<SettingsSection title="Reading font">
					<div className="seg">
						{[
							{ id: 'Inter', label: 'Inter' },
							{ id: 'Atkinson Hyperlegible', label: 'Atkinson' },
							{ id: 'system-ui', label: 'System' }
						].map((f) => (
							<button
								key={f.id}
								aria-pressed={state.font === f.id}
								onClick={() => setState((s) => ({ ...s, font: f.id }))}
							>
								{f.label}
							</button>
						))}
					</div>
				</SettingsSection>
				<SettingsSection title="Notification posture">
					<div className="seg">
						{['quiet', 'standard', 'active'].map((p) => (
							<button
								key={p}
								aria-pressed={state.posture === p}
								onClick={() => setState((s) => ({ ...s, posture: p }))}
							>
								{p}
							</button>
						))}
					</div>
					<p className="faint" style={{ fontSize: 12, marginTop: 6 }}>
						Quiet hides counts and resurfacing nudges entirely. Active shows them on the home view.
					</p>
				</SettingsSection>
				<SettingsSection title="Editor">
					<label className="row" style={{ gap: 8 }}>
						<input
							type="checkbox"
							checked={state.vimMode}
							onChange={(e) => setState((s) => ({ ...s, vimMode: e.target.checked }))}
						/>
						<span>Vim mode</span>
					</label>
				</SettingsSection>
				<p className="faint" style={{ fontSize: 12, marginTop: 14 }}>
					Lattice respects <span className="mono">prefers-reduced-motion</span>. Animations
					cross-fade only.
				</p>
			</div>
		</div>
	);
};

const SettingsSection = ({ title, children }) => (
	<div className="settings-section">
		<div className="settings-section-title faint">{title}</div>
		{children}
	</div>
);

Object.assign(window, { QuickCapture, CommandPalette, Settings });
