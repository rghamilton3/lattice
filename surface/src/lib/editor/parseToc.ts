export interface TocEntry {
	level: number;
	text: string;
	lineNumber: number;
}

const HEADING_RE = /^(#{1,6})\s+(.+)/;

export function parseToc(docText: string): TocEntry[] {
	const entries: TocEntry[] = [];
	const lines = docText.split('\n');
	for (let i = 0; i < lines.length; i++) {
		const m = HEADING_RE.exec(lines[i]);
		if (m) entries.push({ level: m[1].length, text: m[2].trimEnd(), lineNumber: i + 1 });
	}
	return entries;
}
