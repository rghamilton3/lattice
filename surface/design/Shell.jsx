/* Shell — top toolbar, two-pane workbench container, bottom status bar.
   ADHD-aware specifics:
   - Toolbar is sparse: one primary action (Capture), search, command palette, focus.
   - No notification dots; no red counter badges.
   - Bottom status bar shows machine federation state quietly + save state.
   - Focus mode hides chrome to one-pane center column.
*/

const { useEffect } = React;

const Shell = ({ state, setState, onCapture, onCommand, onNav, children }) => {
	const focused = state.focusMode;

	return (
		<div className="shell" data-focus={focused ? 'on' : 'off'}>
			{/* TOP TOOLBAR */}
			<header className="toolbar">
				<div className="row" style={{ gap: 14 }}>
					<button className="brand" onClick={() => onNav('home')} title="Home">
						<span className="brand-dot" />
						<span className="brand-name">lattice</span>
					</button>

					<nav className="row" style={{ gap: 2 }}>
						<NavBtn
							label="Home"
							icon="home"
							active={state.view === 'home'}
							onClick={() => onNav('home')}
						/>
						<NavBtn
							label="Search"
							icon="search"
							active={state.view === 'search'}
							onClick={() => onNav('search')}
						/>
					</nav>
				</div>

				<div className="toolbar-center">
					<button className="palette-button" onClick={onCommand} title="Command palette">
						<Icon name="search" size={14} />
						<span className="palette-button-label">Find anything</span>
						<span className="palette-kbd">
							<span className="kbd">⌘</span>
							<span className="kbd">K</span>
						</span>
					</button>
				</div>

				<div className="row" style={{ gap: 6 }}>
					<button className="capture-button" onClick={onCapture} title="Quick capture (c)">
						<Icon name="plus" size={14} />
						<span>Capture</span>
						<span className="kbd" style={{ marginLeft: 6 }}>
							c
						</span>
					</button>

					<div className="vbar" />

					<button
						className="btn btn-ghost"
						aria-pressed={focused}
						onClick={() => setState((s) => ({ ...s, focusMode: !s.focusMode }))}
						title="Focus mode (hide chrome)"
					>
						<Icon name="focus" size={15} />
					</button>
					<button
						className="btn btn-ghost"
						onClick={() => setState((s) => ({ ...s, settingsOpen: !s.settingsOpen }))}
						aria-pressed={state.settingsOpen}
						title="Settings"
					>
						<Icon name="cog" size={15} />
					</button>
				</div>
			</header>

			{/* MAIN */}
			<main className="main">{children}</main>

			{/* BOTTOM STATUS BAR */}
			<footer className="statusbar">
				<div className="row" style={{ gap: 14 }}>
					<span className="status-dot" data-state="ok" />
					<span className="faint" style={{ fontSize: 12 }}>
						spine&nbsp;·&nbsp;<span className="mono">lattice.rghsoftware.com</span>
					</span>
					<span className="faint" style={{ fontSize: 12 }}>
						2 agents&nbsp;·&nbsp;<span className="mono">personal-laptop</span>,{' '}
						<span className="mono">workstation</span>
					</span>
					<span className="faint" style={{ fontSize: 12 }}>
						last sync 2m ago
					</span>
				</div>
				<div className="row" style={{ gap: 12, fontSize: 12 }}>
					<span className="faint">posture · {state.posture}</span>
					<span className="faint">
						vim ·{' '}
						<span style={{ color: state.vimMode ? 'var(--c-ok)' : undefined }}>
							{state.vimMode ? 'on' : 'off'}
						</span>
					</span>
					<span className="kbd">?</span>
				</div>
			</footer>
		</div>
	);
};

const NavBtn = ({ label, icon, active, onClick }) => (
	<button className="nav-btn" aria-pressed={active} onClick={onClick}>
		<Icon name={icon} size={14} />
		<span>{label}</span>
	</button>
);

/* Pane container — used by Home/Search/Doc views.
   Supports single or split (50/50). The header carries breadcrumb + lateral tools.
*/
const PaneRow = ({ left, right, focusedPane, setFocused, onCloseRight }) => {
	const split = !!right;
	return (
		<div className="pane-row">
			<div
				className="pane-wrap"
				data-focused={focusedPane === 0}
				style={{ flex: split ? '1 1 50%' : '1 1 100%' }}
				onClick={() => setFocused(0)}
			>
				{left}
			</div>
			{split && (
				<div
					className="pane-wrap"
					data-focused={focusedPane === 1}
					style={{ flex: '1 1 50%', borderLeft: '1px solid var(--line)' }}
					onClick={() => setFocused(1)}
				>
					<button
						className="close-pane"
						onClick={(e) => {
							e.stopPropagation();
							onCloseRight();
						}}
						aria-label="Close right pane"
					>
						<Icon name="x" size={14} />
					</button>
					{right}
				</div>
			)}
		</div>
	);
};

const PaneHead = ({ crumbs, right }) => (
	<div className="pane-head">
		<div className="row" style={{ gap: 6, minWidth: 0, flex: 1 }}>
			{crumbs.map((c, i) => (
				<React.Fragment key={i}>
					{i > 0 && (
						<span className="faint" style={{ fontSize: 12 }}>
							·
						</span>
					)}
					{c.onClick ? (
						<button className="crumb" onClick={c.onClick}>
							{c.label}
						</button>
					) : (
						<span className="crumb crumb-current" title={c.label}>
							{c.label}
						</span>
					)}
				</React.Fragment>
			))}
		</div>
		{right && (
			<div className="row" style={{ gap: 4 }}>
				{right}
			</div>
		)}
	</div>
);

Object.assign(window, { Shell, PaneRow, PaneHead });
