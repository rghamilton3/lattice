// Calm relative-time strings — no "overdue", no red.
export function relTime(iso: string, nowMs: number): string {
	const t = new Date(iso).getTime();
	if (!Number.isFinite(t)) return '';
	const diff = Math.max(0, nowMs - t);
	const m = Math.floor(diff / 60000);
	if (m < 1) return 'just now';
	if (m < 60) return `${m}m ago`;
	const h = Math.floor(m / 60);
	if (h < 24) return `${h}h ago`;
	const d = Math.floor(h / 24);
	if (d < 7) return `${d}d ago`;
	const w = Math.floor(d / 7);
	if (w < 5) return `${w}w ago`;
	const mo = Math.floor(d / 30);
	if (mo < 12) return `${mo}mo ago`;
	return `${Math.floor(d / 365)}y ago`;
}
