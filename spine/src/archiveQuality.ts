export type ArchiveQuality = 'good' | 'degraded' | 'failed';

export interface QualityResult {
	quality: ArchiveQuality;
	reason: string;
}

const RENDER_MARKERS = [
	'enable javascript',
	'please enable javascript',
	'requires javascript',
	'javascript is disabled',
	'unsupported browser',
	'checking your browser',
	'just a moment',
];

export function classifyArchive(html: string, text: string): QualityResult {
	if (html.trim().length === 0) return { quality: 'failed', reason: 'empty artifact' };

	const normalized = text.replace(/\s+/g, ' ').trim();
	const haystack = `${html}\n${normalized}`.toLowerCase();
	const marker = RENDER_MARKERS.find((phrase) => haystack.includes(phrase));
	if (marker) return { quality: 'degraded', reason: `browser-rendering marker: ${marker}` };

	const rootOnlyShell = /<div[^>]+id=["'](?:root|app|__next|svelte)["'][^>]*>\s*<\/div>/i.test(
		html,
	);
	if (rootOnlyShell && normalized.length < 500) {
		return { quality: 'degraded', reason: 'mostly empty app shell' };
	}

	const words = normalized.split(/\s+/).filter(Boolean);
	if (words.length < 40)
		return { quality: 'degraded', reason: 'suspiciously short extracted text' };

	return { quality: 'good', reason: 'usable extracted text' };
}
