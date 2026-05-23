import { createStore } from '@tobilu/qmd';
import type { QMDStore } from '@tobilu/qmd';
import type { Database } from 'bun:sqlite';
import { join, dirname, basename, resolve } from 'path';
import { existsSync, mkdirSync, statSync, unlinkSync, writeFileSync } from 'fs';
import { workingDir } from './working';

interface AttachmentData {
	id: number;
	capture_id: number;
	filename: string;
	content_type: string;
	size_bytes: number;
	created_at: string;
}

interface WorkingAttachmentData {
	id: number;
	slug: string;
	filename: string;
	content_type: string;
	size_bytes: number;
	created_at: string;
}

interface CaptureData {
	id: number;
	text: string;
	source: string;
	captured_at: string;
}

export interface SearchResult {
	id: number;
	score: number;
	snippet: string;
	body: string;
	path: string;
	kind: 'capture' | 'local-file' | 'working' | 'capture-attachment' | 'working-attachment';
	machine_id?: string;
	slug?: string;
	capture_id?: number;
	filename?: string;
	modified_at: string;
}

function dbDir(): string {
	return dirname(resolve(process.env.DATABASE_PATH ?? './lattice.dev.db'));
}

export function capturesDir(): string {
	return join(dbDir(), 'captures');
}

export function localFilesDir(): string {
	return join(dbDir(), 'local-files');
}

export function attachmentsMdDir(): string {
	return join(dbDir(), 'attachment-index');
}

export function workingAttachmentsMdDir(): string {
	return join(dbDir(), 'working-attachment-index');
}

function qmdDbPath(): string {
	return join(dbDir(), 'lattice.qmd.db');
}

function sanitize(s: string): string {
	return s.replace(/[\r\n]/g, ' ');
}

export function captureToMarkdown({ id, text, source, captured_at }: CaptureData): string {
	return `---\nid: ${id}\nsource: ${sanitize(source)}\ncaptured_at: ${sanitize(captured_at)}\n---\n\n${text}\n`;
}

export function attachmentToMarkdown({
	id,
	capture_id,
	filename,
	content_type,
	size_bytes,
	created_at,
}: AttachmentData): string {
	return `---\nid: ${id}\ncapture_id: ${capture_id}\nfilename: ${sanitize(filename)}\ncontent_type: ${sanitize(content_type)}\nsize_bytes: ${size_bytes}\ncreated_at: ${sanitize(created_at)}\n---\n\n${sanitize(filename)}\n`;
}

export function workingAttachmentToMarkdown({
	id,
	slug,
	filename,
	content_type,
	size_bytes,
	created_at,
}: WorkingAttachmentData): string {
	return `---\nid: ${id}\nslug: ${sanitize(slug)}\nfilename: ${sanitize(filename)}\ncontent_type: ${sanitize(content_type)}\nsize_bytes: ${size_bytes}\ncreated_at: ${sanitize(created_at)}\n---\n\n${sanitize(filename)}\n`;
}

export function localFileToMarkdown(machineId: string, path: string, text: string): string {
	return `---\nmachine_id: ${sanitize(machineId)}\npath: ${sanitize(path)}\n---\n\n${text}\n`;
}

let _db: Database | null = null;
let _store: QMDStore | null = null;
let _initFailed = false;
let _indexFailures = 0;
// Serial lock: ensures update() and embed() calls never overlap.
let _indexLock: Promise<void> = Promise.resolve();

/** @internal test-only — do not use from production code. */
export function __resetSearchForTests(): void {
	_db = null;
	_store = null;
	_initFailed = false;
	_indexFailures = 0;
	_indexLock = Promise.resolve();
}

/** @internal test-only — do not use from production code. */
export function __getIndexFailuresForTests(): number {
	return _indexFailures;
}

export async function initSearch(db: Database): Promise<void> {
	_db = db;
	const captures = capturesDir();
	const localFiles = localFilesDir();
	const working = workingDir();
	const attachmentsMd = attachmentsMdDir();
	const workingAttachmentsMd = workingAttachmentsMdDir();
	// QMD's glob over `working` runs at createStore time; without the dir
	// present it raises and trips _initFailed. Pre-refactor working.ts mkdir'd
	// at module load; now it only mkdirs lazily, so init must do it.
	mkdirSync(captures, { recursive: true });
	mkdirSync(localFiles, { recursive: true });
	mkdirSync(working, { recursive: true });
	mkdirSync(attachmentsMd, { recursive: true });
	mkdirSync(workingAttachmentsMd, { recursive: true });

	const rows = db
		.query('SELECT id, text, source, captured_at FROM captures')
		.all() as CaptureData[];

	for (const row of rows) {
		const filePath = join(captures, `${row.id}.md`);
		if (!existsSync(filePath)) {
			writeFileSync(filePath, captureToMarkdown(row));
		}
	}

	const attachmentRows = db
		.query(
			'SELECT id, capture_id, filename, content_type, size_bytes, created_at FROM capture_attachments',
		)
		.all() as AttachmentData[];

	for (const row of attachmentRows) {
		const filePath = join(attachmentsMd, `${row.id}.md`);
		if (!existsSync(filePath)) {
			writeFileSync(filePath, attachmentToMarkdown(row));
		}
	}

	const workingAttachmentRows = db
		.query(
			'SELECT id, slug, filename, content_type, size_bytes, created_at FROM working_attachments',
		)
		.all() as WorkingAttachmentData[];

	for (const row of workingAttachmentRows) {
		const filePath = join(workingAttachmentsMd, `${row.id}.md`);
		if (!existsSync(filePath)) {
			writeFileSync(filePath, workingAttachmentToMarkdown(row));
		}
	}

	try {
		_store = await createStore({
			dbPath: qmdDbPath(),
			config: {
				collections: {
					captures: { path: captures, pattern: '**/*.md' },
					working: { path: working, pattern: '**/*.md' },
					'local-files': { path: localFiles, pattern: '**/*.md' },
					'capture-attachments': { path: attachmentsMd, pattern: '**/*.md' },
					'working-attachments': { path: workingAttachmentsMd, pattern: '**/*.md' },
				},
			},
		});
	} catch (e) {
		_initFailed = true;
		console.error('[qmd] initSearch failed — search unavailable:', e);
		throw e;
	}

	refreshIndex();
}

export function writeCaptureFile(
	id: number,
	text: string,
	source: string,
	captured_at: string,
): void {
	writeFileSync(
		join(capturesDir(), `${id}.md`),
		captureToMarkdown({ id, text, source, captured_at }),
	);
}

export function writeWorkingAttachmentIndex(
	id: number,
	slug: string,
	filename: string,
	content_type: string,
	size_bytes: number,
	created_at: string,
): void {
	writeFileSync(
		join(workingAttachmentsMdDir(), `${id}.md`),
		workingAttachmentToMarkdown({ id, slug, filename, content_type, size_bytes, created_at }),
	);
}

export function deleteWorkingAttachmentIndex(id: number): void {
	const mdPath = join(workingAttachmentsMdDir(), `${id}.md`);
	if (existsSync(mdPath)) unlinkSync(mdPath);
}

export function writeAttachmentIndex(
	id: number,
	capture_id: number,
	filename: string,
	content_type: string,
	size_bytes: number,
	created_at: string,
): void {
	writeFileSync(
		join(attachmentsMdDir(), `${id}.md`),
		attachmentToMarkdown({ id, capture_id, filename, content_type, size_bytes, created_at }),
	);
}

export function writeLocalFile(
	machineId: string,
	path: string,
	hash: string,
	text: string,
	prevHash?: string,
): void {
	const machineDir = join(localFilesDir(), machineId);
	mkdirSync(machineDir, { recursive: true });
	if (prevHash && prevHash !== hash) {
		const oldFile = join(machineDir, `${prevHash}.md`);
		if (existsSync(oldFile)) unlinkSync(oldFile);
	}
	writeFileSync(join(machineDir, `${hash}.md`), localFileToMarkdown(machineId, path, text));
}

export function refreshIndex(): void {
	if (!_store) return;
	const store = _store;
	_indexLock = _indexLock
		.then(async () => {
			const result = await store.update();
			if (result.needsEmbedding > 0) {
				await store.embed();
			}
		})
		.catch((e) => {
			_indexFailures++;
			if (_indexFailures === 1 || _indexFailures % 10 === 0) {
				console.warn(`[qmd] index refresh failed (${_indexFailures}x):`, e);
			}
		});
}

// QMD returns `file` as a virtual path: qmd://<collection>/<relative-path>.
const VIRTUAL_PATH = /^qmd:\/\/([^/]+)\/(.+)$/;

function mapResults(
	hits: Array<{
		file: string;
		score: number;
		bestChunk: string;
		body: string;
		displayPath: string;
	}>,
): SearchResult[] {
	const captureStmt = _db?.query('SELECT captured_at FROM captures WHERE id = ?');
	const fileStmt = _db?.query(
		'SELECT modified_at FROM file_index WHERE machine_id = ? AND hash = ?',
	);
	return hits.flatMap((r): SearchResult[] => {
		const m = VIRTUAL_PATH.exec(r.file);
		if (!m) return [];
		const [, collection, relPath] = m;
		if (collection === 'captures') {
			const id = parseInt(basename(relPath, '.md'), 10);
			if (isNaN(id)) return [];
			const captureRow = captureStmt?.get(id) as { captured_at: string } | null;
			return [
				{
					id,
					score: r.score,
					snippet: r.bestChunk,
					body: r.body,
					path: r.displayPath,
					kind: 'capture' as const,
					modified_at: captureRow?.captured_at ?? '',
				},
			];
		}
		if (collection === 'working') {
			const slug = basename(relPath, '.md');
			let modified_at = '';
			try {
				modified_at = statSync(join(workingDir(), `${slug}.md`)).mtime.toISOString();
			} catch {
				// file missing between index and search
			}
			return [
				{
					id: 0,
					score: r.score,
					snippet: r.bestChunk,
					body: r.body,
					path: r.displayPath,
					kind: 'working' as const,
					slug,
					modified_at,
				},
			];
		}
		if (collection === 'local-files') {
			const parts = relPath.split('/');
			const machine_id = parts[0];
			const hash = basename(parts[1] ?? '', '.md');
			const fileRow = fileStmt?.get(machine_id, hash) as { modified_at: string } | null;
			return [
				{
					id: 0,
					score: r.score,
					snippet: r.bestChunk,
					body: r.body,
					path: r.displayPath,
					kind: 'local-file' as const,
					machine_id,
					modified_at: fileRow?.modified_at ?? '',
				},
			];
		}
		if (collection === 'capture-attachments') {
			const id = parseInt(basename(relPath, '.md'), 10);
			if (isNaN(id)) return [];
			const attRow = _db
				?.query('SELECT capture_id, filename, created_at FROM capture_attachments WHERE id = ?')
				.get(id) as { capture_id: number; filename: string; created_at: string } | null;
			return [
				{
					id,
					score: r.score,
					snippet: r.bestChunk,
					body: r.body,
					path: r.displayPath,
					kind: 'capture-attachment' as const,
					capture_id: attRow?.capture_id,
					filename: attRow?.filename,
					modified_at: attRow?.created_at ?? '',
				},
			];
		}
		if (collection === 'working-attachments') {
			const id = parseInt(basename(relPath, '.md'), 10);
			if (isNaN(id)) return [];
			const attRow = _db
				?.query('SELECT slug, filename, created_at FROM working_attachments WHERE id = ?')
				.get(id) as { slug: string; filename: string; created_at: string } | null;
			return [
				{
					id,
					score: r.score,
					snippet: r.bestChunk,
					body: r.body,
					path: r.displayPath,
					kind: 'working-attachment' as const,
					slug: attRow?.slug,
					filename: attRow?.filename,
					modified_at: attRow?.created_at ?? '',
				},
			];
		}
		return [];
	});
}

export async function search(q: string): Promise<SearchResult[]> {
	if (!_store) {
		if (_initFailed)
			console.warn('[qmd] search called but initSearch failed — returning empty results');
		return [];
	}
	const results = await _store.search({
		queries: [
			{ type: 'lex', query: q },
			{ type: 'vec', query: q },
		],
		rerank: false,
		limit: 20,
	});
	return mapResults(results);
}

export async function searchDeep(q: string): Promise<SearchResult[]> {
	if (!_store) {
		if (_initFailed)
			console.warn('[qmd] searchDeep called but initSearch failed — returning empty results');
		return [];
	}
	try {
		const results = await _store.search({ query: q, limit: 20 });
		return mapResults(results);
	} catch (e) {
		console.error('[qmd] searchDeep error:', e);
		throw e;
	}
}
