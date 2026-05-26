import type { Database } from 'bun:sqlite';
import { createHash } from 'node:crypto';
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, join, resolve, sep } from 'node:path';
import { getDatabasePath } from './config';
import { archiveToMarkdown, writeArchiveIndex } from './search';
import type { ArchiveQuality } from './archiveQuality';

export type CaptureMethod = 'singlefile' | 'monolith';
export type ArchiveAction = 'keep' | 'archive' | 'recapture' | 'delete' | 'skip' | 'auto-kept';

export interface ArchiveRow {
	id: number;
	url: string;
	title: string | null;
	archived_at: string;
	captured_via: CaptureMethod;
	hash: string;
	archive_path: string;
	extracted_text: string;
	source: string | null;
	why_saved: string | null;
	quality: ArchiveQuality;
	supersedes: number | null;
	superseded_by: number | null;
	reviewed_at: string | null;
	review_action: string | null;
	deleted_at: string | null;
}

export interface CreateArchiveInput {
	url: string;
	title?: string | null;
	html: string;
	capturedVia: CaptureMethod;
	source?: string | null;
	whySaved?: string | null;
	quality: ArchiveQuality;
	archiveDir: string;
}

function defaultArchiveDir(): string {
	return join(dirname(resolve(getDatabasePath())), 'web');
}

export function archiveStorageDir(configured?: string): string {
	return resolve(configured ?? process.env.ARCHIVE_STORAGE_DIR ?? defaultArchiveDir());
}

export function normalizeArchiveUrl(value: string): string {
	const parsed = new URL(value.trim());
	if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:')
		throw new Error('URL must be http(s)');
	parsed.hash = '';
	return parsed.toString();
}

export function cleanOptionalLine(value: string | null | undefined, max = 240): string | null {
	const trimmed = value?.replace(/[\r\n]+/g, ' ').trim() ?? '';
	return trimmed ? trimmed.slice(0, max) : null;
}

export function extractArchiveText(html: string): string {
	return html
		.replace(/<script\b[^>]*>[\s\S]*?<\/script>/gi, ' ')
		.replace(/<style\b[^>]*>[\s\S]*?<\/style>/gi, ' ')
		.replace(/<[^>]+>/g, ' ')
		.replace(/&nbsp;/gi, ' ')
		.replace(/&amp;/gi, '&')
		.replace(/&lt;/gi, '<')
		.replace(/&gt;/gi, '>')
		.replace(/&quot;/gi, '"')
		.replace(/&#39;/g, "'")
		.replace(/\s+/g, ' ')
		.trim();
}

export function titleFromHtml(html: string): string | null {
	const match = /<title[^>]*>([\s\S]*?)<\/title>/i.exec(html);
	return cleanOptionalLine(match ? extractArchiveText(match[1]) : null, 300);
}

function archivePathForHash(baseDir: string, hash: string): string {
	return join(baseDir, `${hash}.html`);
}

export function assertArchivePath(baseDir: string, filePath: string): string {
	const base = resolve(baseDir);
	const resolved = resolve(filePath);
	const baseWithSep = base.endsWith(sep) ? base : `${base}${sep}`;
	if (resolved !== base && !resolved.startsWith(baseWithSep))
		throw new Error('archive path escapes storage dir');
	return resolved;
}

export function createArchive(
	db: Database,
	input: CreateArchiveInput,
): ArchiveRow & { superseded: number[] } {
	const url = normalizeArchiveUrl(input.url);
	if (input.html.length === 0 && input.quality !== 'failed')
		throw new Error('archive html is required');
	const archivedAt = new Date().toISOString();
	const archiveDir = archiveStorageDir(input.archiveDir);
	mkdirSync(archiveDir, { recursive: true });
	const bytes = Buffer.from(input.html, 'utf8');
	const hash = createHash('sha256').update(bytes).digest('hex');
	const archivePath = assertArchivePath(archiveDir, archivePathForHash(archiveDir, hash));
	const extractedText = extractArchiveText(input.html);
	const title = cleanOptionalLine(input.title, 300) ?? titleFromHtml(input.html) ?? url;
	const source = cleanOptionalLine(input.source, 120);
	const whySaved = cleanOptionalLine(input.whySaved);

	const result = db.transaction(() => {
		if (!existsSync(archivePath)) writeFileSync(archivePath, bytes);

		const older =
			input.quality === 'good'
				? (db
						.query(
							`SELECT id FROM archives
							 WHERE url = ? AND deleted_at IS NULL AND superseded_by IS NULL AND quality IN ('degraded', 'failed')`,
						)
						.all(url) as { id: number }[])
				: [];
		const supersedes = older[0]?.id ?? null;
		const row = db
			.prepare(
				`INSERT INTO archives
				 (url, title, archived_at, captured_via, hash, archive_path, extracted_text, source, why_saved, quality, supersedes)
				 VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
				 RETURNING id, url, title, archived_at, captured_via, hash, archive_path, extracted_text, source, why_saved, quality, supersedes, superseded_by, reviewed_at, review_action, deleted_at`,
			)
			.get(
				url,
				title,
				archivedAt,
				input.capturedVia,
				hash,
				archivePath,
				extractedText,
				source,
				whySaved,
				input.quality,
				supersedes,
			) as ArchiveRow;

		if (older.length > 0) {
			const ids = older.map((r) => r.id);
			const placeholders = ids.map(() => '?').join(',');
			db.prepare(`UPDATE archives SET superseded_by = ? WHERE id IN (${placeholders})`).run(
				row.id,
				...ids,
			);
		}

		writeArchiveIndex(row);
		return { ...row, superseded: older.map((r) => r.id) };
	})();

	return result;
}

export function getArchive(db: Database, id: number): ArchiveRow | null {
	return db
		.query(
			`SELECT id, url, title, archived_at, captured_via, hash, archive_path, extracted_text, source, why_saved, quality, supersedes, superseded_by, reviewed_at, review_action, deleted_at
			 FROM archives WHERE id = ? AND deleted_at IS NULL`,
		)
		.get(id) as ArchiveRow | null;
}

export function listArchiveInboxRows(db: Database, limit: number): ArchiveRow[] {
	autoKeepSettledArchives(db);
	return db
		.query(
			`SELECT id, url, title, archived_at, captured_via, hash, archive_path, extracted_text, source, why_saved, quality, supersedes, superseded_by, reviewed_at, review_action, deleted_at
			 FROM archives
			 WHERE deleted_at IS NULL AND superseded_by IS NULL AND reviewed_at IS NULL
			   AND (quality IN ('degraded', 'failed') OR (quality = 'good' AND archived_at >= datetime('now', '-3 days')))
			 ORDER BY archived_at DESC, id DESC LIMIT ?`,
		)
		.all(limit) as ArchiveRow[];
}

export function autoKeepSettledArchives(db: Database): void {
	const now = new Date().toISOString();
	db.prepare(
		`UPDATE archives SET reviewed_at = ?, review_action = 'auto-kept'
		 WHERE quality = 'good' AND reviewed_at IS NULL AND deleted_at IS NULL AND superseded_by IS NULL
		   AND archived_at < datetime('now', '-3 days')`,
	).run(now);
}

export function applyArchiveAction(
	db: Database,
	id: number,
	action: ArchiveAction,
): { url: string } | null {
	const row = getArchive(db, id);
	if (!row) return null;
	const now = new Date().toISOString();
	if (action === 'recapture') return { url: row.url };
	if (action === 'delete') {
		db.prepare(
			'UPDATE archives SET deleted_at = ?, reviewed_at = ?, review_action = ? WHERE id = ?',
		).run(now, now, action, id);
		return { url: row.url };
	}
	db.prepare('UPDATE archives SET reviewed_at = ?, review_action = ? WHERE id = ?').run(
		now,
		action,
		id,
	);
	return { url: row.url };
}

export function archiveMarkdown(
	row: Pick<ArchiveRow, 'id' | 'url' | 'title' | 'archived_at' | 'quality' | 'extracted_text'>,
): string {
	return archiveToMarkdown(row);
}

export function readArchiveArtifact(row: ArchiveRow, archiveDir: string): string {
	const safePath = assertArchivePath(archiveStorageDir(archiveDir), row.archive_path);
	return readFileSync(safePath, 'utf8');
}
