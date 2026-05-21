import type { DocRef } from '$lib/types';

// Deep-link parity:
//   ?ref=working:my-slug — open a working doc
//   ?ref=capture:123     — open a capture (id must be > 0)
//   ?ref=file:42         — open a file (id must be > 0)
export function parseRef(raw: string): DocRef | null {
	const ix = raw.indexOf(':');
	if (ix <= 0) return null;
	const kind = raw.slice(0, ix);
	const rest = raw.slice(ix + 1);
	if (!rest) return null;
	if (kind === 'working') return { kind: 'working', slug: rest };
	if (kind === 'capture') {
		const id = Number(rest);
		return Number.isFinite(id) && id > 0 ? { kind: 'capture', id } : null;
	}
	if (kind === 'file') {
		const id = Number(rest);
		return Number.isFinite(id) && id > 0 ? { kind: 'file', id } : null;
	}
	return null;
}
