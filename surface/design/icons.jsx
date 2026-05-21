/* Small line icons — 1.5px stroke, currentColor.
   Kept SVGs simple (rects/circles/strokes only) — no hand-drawn complex art.
*/

const Icon = ({ name, size = 16, ...rest }) => {
	const s = size;
	const common = {
		width: s,
		height: s,
		viewBox: '0 0 24 24',
		fill: 'none',
		stroke: 'currentColor',
		strokeWidth: 1.6,
		strokeLinecap: 'round',
		strokeLinejoin: 'round',
		'aria-hidden': true,
		focusable: 'false',
		...rest
	};
	switch (name) {
		case 'search':
			return (
				<svg {...common}>
					<circle cx="11" cy="11" r="6.5" />
					<path d="M20 20l-3.7-3.7" />
				</svg>
			);
		case 'plus':
			return (
				<svg {...common}>
					<path d="M12 5v14M5 12h14" />
				</svg>
			);
		case 'inbox':
			return (
				<svg {...common}>
					<path d="M3 13l3-8h12l3 8v6H3v-6z" />
					<path d="M3 13h5l1 2h6l1-2h5" />
				</svg>
			);
		case 'doc':
			return (
				<svg {...common}>
					<path d="M6 3h9l4 4v14H6z" />
					<path d="M14 3v5h5" />
				</svg>
			);
		case 'edit':
			return (
				<svg {...common}>
					<path d="M4 20h4l10-10-4-4L4 16v4z" />
				</svg>
			);
		case 'home':
			return (
				<svg {...common}>
					<path d="M3 11l9-7 9 7v9h-6v-6h-6v6H3z" />
				</svg>
			);
		case 'sparkle':
			return (
				<svg {...common}>
					<path d="M12 4v6M12 14v6M4 12h6M14 12h6" />
					<path d="M7 7l3 3M14 14l3 3M17 7l-3 3M10 14l-3 3" />
				</svg>
			);
		case 'sim':
			return (
				<svg {...common}>
					<path d="M5 7c2.5-3 5-3 7 0M5 12c2.5-3 5-3 7 0M5 17c2.5-3 5-3 7 0" />
					<path d="M12 7c2.5-3 5-3 7 0M12 12c2.5-3 5-3 7 0M12 17c2.5-3 5-3 7 0" />
				</svg>
			);
		case 'quote':
			return (
				<svg {...common}>
					<path d="M6 8h5v4c0 3-2 5-5 5" />
					<path d="M14 8h5v4c0 3-2 5-5 5" />
				</svg>
			);
		case 'clock':
			return (
				<svg {...common}>
					<circle cx="12" cy="12" r="8.5" />
					<path d="M12 7v5l3 2" />
				</svg>
			);
		case 'arrow-right':
			return (
				<svg {...common}>
					<path d="M5 12h13M13 6l6 6-6 6" />
				</svg>
			);
		case 'split':
			return (
				<svg {...common}>
					<rect x="3.5" y="4" width="17" height="16" rx="2" />
					<path d="M12 4v16" />
				</svg>
			);
		case 'x':
			return (
				<svg {...common}>
					<path d="M6 6l12 12M18 6L6 18" />
				</svg>
			);
		case 'check':
			return (
				<svg {...common}>
					<path d="M5 12l4 4 10-10" />
				</svg>
			);
		case 'archive':
			return (
				<svg {...common}>
					<rect x="3.5" y="5" width="17" height="4" rx="1" />
					<path d="M5 9v10h14V9" />
					<path d="M10 13h4" />
				</svg>
			);
		case 'promote':
			return (
				<svg {...common}>
					<path d="M12 19V5M5 12l7-7 7 7" />
				</svg>
			);
		case 'task':
			return (
				<svg {...common}>
					<rect x="3.5" y="3.5" width="17" height="17" rx="3" />
					<path d="M8 12l3 3 5-6" />
				</svg>
			);
		case 'skip':
			return (
				<svg {...common}>
					<path d="M5 5l8 7-8 7zM16 5v14" />
				</svg>
			);
		case 'focus':
			return (
				<svg {...common}>
					<path d="M4 9V5h4M16 5h4v4M20 15v4h-4M8 19H4v-4" />
					<circle cx="12" cy="12" r="3" />
				</svg>
			);
		case 'cmd':
			return (
				<svg {...common}>
					<path d="M9 9V6a2 2 0 1 0-2 2h10a2 2 0 1 0-2-2v3M9 15v3a2 2 0 1 1-2-2h10a2 2 0 1 1-2 2v-3M9 9h6v6H9z" />
				</svg>
			);
		case 'cog':
			return (
				<svg {...common}>
					<circle cx="12" cy="12" r="3" />
					<path d="M12 3v3M12 18v3M21 12h-3M6 12H3M18.4 5.6l-2.1 2.1M7.7 16.3l-2.1 2.1M18.4 18.4l-2.1-2.1M7.7 7.7L5.6 5.6" />
				</svg>
			);
		case 'circle':
			return (
				<svg {...common}>
					<circle cx="12" cy="12" r="4" />
				</svg>
			);
		case 'mic':
			return (
				<svg {...common}>
					<rect x="9" y="3.5" width="6" height="11" rx="3" />
					<path d="M6 11a6 6 0 0 0 12 0M12 17v3.5M9 20.5h6" />
				</svg>
			);
		case 'link':
			return (
				<svg {...common}>
					<path d="M10 14a4 4 0 0 0 5.7 0l3-3a4 4 0 0 0-5.7-5.7l-1 1" />
					<path d="M14 10a4 4 0 0 0-5.7 0l-3 3a4 4 0 0 0 5.7 5.7l1-1" />
				</svg>
			);
		case 'chev-down':
			return (
				<svg {...common}>
					<path d="M6 9l6 6 6-6" />
				</svg>
			);
		case 'chev-right':
			return (
				<svg {...common}>
					<path d="M9 6l6 6-6 6" />
				</svg>
			);
		default:
			return null;
	}
};

// Utility — relative-time strings, calm tone (no "overdue" language).
function relTime(iso, nowMs) {
	const t = new Date(iso).getTime();
	const diff = Math.max(0, nowMs - t);
	const m = Math.floor(diff / 60000);
	if (m < 1) return 'just now';
	if (m < 60) return m + 'm ago';
	const h = Math.floor(m / 60);
	if (h < 24) return h + 'h ago';
	const d = Math.floor(h / 24);
	if (d < 7) return d + 'd ago';
	const w = Math.floor(d / 7);
	if (w < 5) return w + 'w ago';
	const mo = Math.floor(d / 30);
	if (mo < 12) return mo + 'mo ago';
	return Math.floor(d / 365) + 'y ago';
}

Object.assign(window, { Icon, relTime });
