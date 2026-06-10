import { createStore, extractSnippet } from '@tobilu/qmd';
import { getQmdModelsConfig } from './config';
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

interface ArchiveData {
	id: number;
	url: string;
	title: string | null;
	archived_at: string;
	quality: string;
	extracted_text: string;
}

interface AnnotationData {
	id: string;
	target_kind: 'capture' | 'local_file' | 'working' | 'archive';
	target_id: string;
	selection_text: string | null;
	comment: string;
	created_at: string;
	updated_at: string;
}

export interface SearchResult {
	id: number | string;
	score: number;
	snippet: string;
	body: string;
	path: string;
	kind:
		| 'capture'
		| 'local-file'
		| 'working'
		| 'capture-attachment'
		| 'working-attachment'
		| 'archive'
		| 'annotation';
	machine_id?: string;
	slug?: string;
	capture_id?: number;
	filename?: string;
	url?: string;
	title?: string | null;
	target_kind?: AnnotationData['target_kind'];
	target_id?: string;
	annotation_id?: string;
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

export function archivesMdDir(): string {
	return join(dbDir(), 'archive-index');
}

export function annotationsMdDir(): string {
	return join(dbDir(), 'annotation-index');
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

export function attachmentToMarkdown(data: AttachmentData, extractedText = ''): string {
	const { id, capture_id, filename, content_type, size_bytes, created_at } = data;
	const body = extractedText ? `${sanitize(filename)}\n\n${extractedText}` : sanitize(filename);
	return `---\nid: ${id}\ncapture_id: ${capture_id}\nfilename: ${sanitize(filename)}\ncontent_type: ${sanitize(content_type)}\nsize_bytes: ${size_bytes}\ncreated_at: ${sanitize(created_at)}\n---\n\n${body}\n`;
}

export function workingAttachmentToMarkdown(
	data: WorkingAttachmentData,
	extractedText = '',
): string {
	const { id, slug, filename, content_type, size_bytes, created_at } = data;
	const body = extractedText ? `${sanitize(filename)}\n\n${extractedText}` : sanitize(filename);
	return `---\nid: ${id}\nslug: ${sanitize(slug)}\nfilename: ${sanitize(filename)}\ncontent_type: ${sanitize(content_type)}\nsize_bytes: ${size_bytes}\ncreated_at: ${sanitize(created_at)}\n---\n\n${body}\n`;
}

export function localFileToMarkdown(machineId: string, path: string, text: string): string {
	return `---\nmachine_id: ${sanitize(machineId)}\npath: ${sanitize(path)}\n---\n\n${text}\n`;
}

export function archiveToMarkdown({
	id,
	url,
	title,
	archived_at,
	quality,
	extracted_text,
}: ArchiveData): string {
	return `---\nid: ${id}\nurl: ${sanitize(url)}\ntitle: ${sanitize(title ?? url)}\narchived_at: ${sanitize(archived_at)}\nquality: ${sanitize(quality)}\n---\n\n${sanitize(title ?? url)}\n\n${extracted_text}\n`;
}

export function annotationToMarkdown({
	id,
	target_kind,
	target_id,
	selection_text,
	comment,
	created_at,
	updated_at,
}: AnnotationData): string {
	const selected = selection_text ? `\n\nSelected passage:\n${selection_text}\n` : '';
	return `---\nid: ${sanitize(id)}\ntarget_kind: ${target_kind}\ntarget_id: ${sanitize(target_id)}\ncreated_at: ${sanitize(created_at)}\nupdated_at: ${sanitize(updated_at)}\n---\n\nAnnotation on ${target_kind} ${sanitize(target_id)}${selected}\n\nComment:\n${comment}\n`;
}

let _db: Database | null = null;
let _store: QMDStore | null = null;
let _initFailed = false;
// Consecutive index-refresh (update) failures; reset to 0 on the next success.
// A nonzero value means new documents may not be findable even by keyword, so it
// is surfaced on /api/status rather than silently swallowed.
let _indexFailures = 0;
// Serial lock: ensures update() and embed() calls never overlap.
let _indexLock: Promise<void> = Promise.resolve();
// Degraded mode: the remote inference endpoint is unreachable, so search serves
// BM25 keyword-only results. QMD's circuit-breaker state is private, so we infer
// it from the inference calls themselves.
//
// Invariant: _degraded is set true by ANY failed inference call (search,
// searchRelated, embed) and set false by ANY successful one. A code path that
// makes no inference call (e.g. a backfill tick that finds nothing pending) must
// leave it unchanged — it cannot confirm recovery, so it must not clear the flag.
// This biases the indicator toward stale-true (safe) over false-healthy.
let _degraded = false;
// Embedding backfill: when the endpoint is down, docs are indexed lexically now
// and embedded later. QMD persists `needsEmbedding` in its own DB, so this resumes
// across restarts; the loop retries embed() with backoff until the corpus is covered.
let _backfillTimer: ReturnType<typeof setTimeout> | null = null;
let _backfillRunning = false;
const BACKFILL_MIN_MS = 30_000;
const BACKFILL_MAX_MS = 10 * 60_000;
let _backfillDelayMs = BACKFILL_MIN_MS;
// Short-lived memo for the embedding-backlog count. /api/status may be polled
// frequently and getIndexHealth() runs a COUNT join, so cache it briefly. A null
// `value` means the count is currently unknown (store not ready / read failed).
const NEEDS_EMBEDDING_TTL_MS = 5_000;
let _needsEmbeddingCache: { value: number | null; at: number } | null = null;

/** Whether the latest inference attempt found the remote endpoint unavailable. */
export function isSearchDegraded(): boolean {
	return _degraded;
}

export function getQmdStore(): QMDStore | null {
	return _store;
}

/** Consecutive index-refresh failures (lexical update); 0 when the index is current. */
export function indexFailureCount(): number {
	return _indexFailures;
}

/**
 * Documents indexed but still awaiting embedding. Returns `null` when the count is
 * unknown — the store is not initialized yet, or `getIndexHealth()` threw — so callers
 * can distinguish "unknown" from a genuine zero backlog. Memoized for a few seconds so
 * frequent /api/status polls do not each run the underlying COUNT.
 */
export async function needsEmbeddingCount(): Promise<number | null> {
	const now = Date.now();
	if (_needsEmbeddingCache && now - _needsEmbeddingCache.at < NEEDS_EMBEDDING_TTL_MS) {
		return _needsEmbeddingCache.value;
	}
	let value: number | null = null;
	if (_store) {
		try {
			value = (await _store.getIndexHealth()).needsEmbedding;
		} catch (e) {
			console.warn('[qmd] needsEmbeddingCount: getIndexHealth failed — reporting unknown:', e);
			value = null;
		}
	}
	_needsEmbeddingCache = { value, at: now };
	return value;
}

/** @internal test-only — do not use from production code. */
export function __resetSearchForTests(): void {
	stopEmbeddingBackfill();
	_db = null;
	_store = null;
	_initFailed = false;
	_indexFailures = 0;
	_indexLock = Promise.resolve();
	_degraded = false;
	_backfillRunning = false;
	_backfillDelayMs = BACKFILL_MIN_MS;
	_needsEmbeddingCache = null;
}

/** @internal test-only — current backfill backoff delay in ms. */
export function __getBackfillDelayForTests(): number {
	return _backfillDelayMs;
}

/** @internal test-only — inject a fake store to exercise search/backfill paths. */
export function __setStoreForTests(store: QMDStore | null): void {
	_store = store;
	_initFailed = false;
}

/** @internal test-only — do not use from production code. */
export function __getIndexFailuresForTests(): number {
	return _indexFailures;
}

/** @internal test-only — run one embedding-backfill pass synchronously (no timer). */
export async function __runBackfillForTests(): Promise<void> {
	await runBackfill();
}

/** @internal test-only — await the in-flight refreshIndex() lock chain. */
export async function __awaitIndexLockForTests(): Promise<void> {
	await _indexLock;
}

export async function initSearch(db: Database): Promise<void> {
	_db = db;
	const captures = capturesDir();
	const localFiles = localFilesDir();
	const working = workingDir();
	const attachmentsMd = attachmentsMdDir();
	const workingAttachmentsMd = workingAttachmentsMdDir();
	const archivesMd = archivesMdDir();
	const annotationsMd = annotationsMdDir();
	// QMD's glob over `working` runs at createStore time; without the dir
	// present it raises and trips _initFailed. Pre-refactor working.ts mkdir'd
	// at module load; now it only mkdirs lazily, so init must do it.
	mkdirSync(captures, { recursive: true });
	mkdirSync(localFiles, { recursive: true });
	mkdirSync(working, { recursive: true });
	mkdirSync(attachmentsMd, { recursive: true });
	mkdirSync(workingAttachmentsMd, { recursive: true });
	mkdirSync(archivesMd, { recursive: true });
	mkdirSync(annotationsMd, { recursive: true });

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
			`SELECT ca.id, ca.capture_id, ca.filename, ca.content_type, ca.size_bytes, ca.created_at,
			        ca.extraction_status, ca.extracted_text,
			        ad.final_text as description_text
			 FROM capture_attachments ca
			 LEFT JOIN attachment_descriptions ad ON (
			   ad.attachment_kind = 'capture' AND ad.attachment_id = ca.id AND ad.supersedes IS NULL
			 )`,
		)
		.all() as (AttachmentData & {
		extraction_status: string;
		extracted_text: string;
		description_text: string | null;
	})[];

	for (const row of attachmentRows) {
		const filePath = join(attachmentsMd, `${row.id}.md`);
		if (!existsSync(filePath)) {
			const text =
				row.extraction_status === 'dark' ? (row.description_text ?? '') : row.extracted_text;
			writeFileSync(filePath, attachmentToMarkdown(row, text));
		}
	}

	const workingAttachmentRows = db
		.query(
			`SELECT wa.id, wa.slug, wa.filename, wa.content_type, wa.size_bytes, wa.created_at,
			        wa.extraction_status, wa.extracted_text,
			        ad.final_text as description_text
			 FROM working_attachments wa
			 LEFT JOIN attachment_descriptions ad ON (
			   ad.attachment_kind = 'working' AND ad.attachment_id = wa.id AND ad.supersedes IS NULL
			 )`,
		)
		.all() as (WorkingAttachmentData & {
		extraction_status: string;
		extracted_text: string;
		description_text: string | null;
	})[];

	for (const row of workingAttachmentRows) {
		const filePath = join(workingAttachmentsMd, `${row.id}.md`);
		if (!existsSync(filePath)) {
			const text =
				row.extraction_status === 'dark' ? (row.description_text ?? '') : row.extracted_text;
			writeFileSync(filePath, workingAttachmentToMarkdown(row, text));
		}
	}

	const archiveRows = db
		.query(
			`SELECT id, url, title, archived_at, quality, extracted_text FROM archives
			 WHERE quality = 'good' AND superseded_by IS NULL AND deleted_at IS NULL`,
		)
		.all() as ArchiveData[];

	for (const row of archiveRows) {
		const filePath = join(archivesMd, `${row.id}.md`);
		if (!existsSync(filePath)) {
			writeFileSync(filePath, archiveToMarkdown(row));
		}
	}

	const annotationRows = db
		.query(
			'SELECT id, target_kind, target_id, selection_text, comment, created_at, updated_at FROM annotations',
		)
		.all() as AnnotationData[];

	for (const row of annotationRows) {
		const filePath = join(annotationsMd, `${row.id}.md`);
		if (!existsSync(filePath)) {
			writeFileSync(filePath, annotationToMarkdown(row));
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
					archives: { path: archivesMd, pattern: '**/*.md' },
					annotations: { path: annotationsMd, pattern: '**/*.md' },
				},
				models: getQmdModelsConfig(),
			},
		});
	} catch (e) {
		_initFailed = true;
		console.error('[qmd] initSearch failed — search unavailable:', e);
		throw e;
	}

	refreshIndex();
	// Backfill any docs left unembedded from a prior outage (QMD persists this state).
	startEmbeddingBackfill();
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

export function writeArchiveIndex(row: ArchiveData): void {
	mkdirSync(archivesMdDir(), { recursive: true });
	writeFileSync(join(archivesMdDir(), `${row.id}.md`), archiveToMarkdown(row));
}

export function writeAnnotationIndex(row: AnnotationData): void {
	mkdirSync(annotationsMdDir(), { recursive: true });
	writeFileSync(join(annotationsMdDir(), `${row.id}.md`), annotationToMarkdown(row));
}

export function deleteAnnotationIndex(id: string): void {
	const mdPath = join(annotationsMdDir(), `${id}.md`);
	if (existsSync(mdPath)) unlinkSync(mdPath);
}

export function writeWorkingAttachmentIndex(
	id: number,
	slug: string,
	filename: string,
	content_type: string,
	size_bytes: number,
	created_at: string,
	extractedText = '',
): void {
	writeFileSync(
		join(workingAttachmentsMdDir(), `${id}.md`),
		workingAttachmentToMarkdown(
			{ id, slug, filename, content_type, size_bytes, created_at },
			extractedText,
		),
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
	extractedText = '',
): void {
	writeFileSync(
		join(attachmentsMdDir(), `${id}.md`),
		attachmentToMarkdown(
			{ id, capture_id, filename, content_type, size_bytes, created_at },
			extractedText,
		),
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
			// update() indexes lexically (FTS) and persists which docs still need
			// embedding. This must succeed for captures to be keyword-findable now.
			const result = await store.update();
			// update() succeeded: the lexical index is current. Clear the failure streak
			// so indexFailureCount() reflects consecutive failures, not lifetime total.
			_indexFailures = 0;
			if (result.needsEmbedding > 0) {
				// Embedding goes through the remote endpoint. If it is down this throws;
				// the doc stays keyword-findable and the backfill loop retries later.
				await tryEmbed(store);
			}
		})
		.catch((e) => {
			// A failure here means update() itself failed (not embedding): the collection
			// could not be re-indexed (filesystem scan or lexical write). New documents may
			// not be findable even by keyword. Embedding failures are swallowed by tryEmbed
			// and never reach here. The streak is surfaced via indexFailureCount() on
			// /api/status so a stuck lexical index does not read as "healthy".
			_indexFailures++;
			if (_indexFailures === 1) {
				console.warn('[qmd] index refresh failed:', e);
			} else if (_indexFailures % 10 === 0) {
				console.error(`[qmd] index refresh still failing (${_indexFailures}x consecutive):`, e);
			}
		});
}

/**
 * Attempt to embed pending documents through the remote endpoint. Embedding failure
 * (endpoint down / breaker open) is non-fatal: it flips degraded mode on and ensures
 * the backfill loop is scheduled, but never rejects the index lock chain.
 */
async function tryEmbed(store: QMDStore): Promise<void> {
	try {
		await store.embed();
		_degraded = false;
	} catch (e) {
		_degraded = true;
		console.warn('[qmd] embedding deferred — endpoint unavailable, will backfill:', e);
		scheduleBackfill();
	}
}

/** Start the embedding backfill loop (idempotent). Called from initSearch. */
export function startEmbeddingBackfill(): void {
	if (_backfillTimer || _backfillRunning) return;
	scheduleBackfill();
}

/** Stop the embedding backfill loop and clear any pending timer. */
export function stopEmbeddingBackfill(): void {
	if (_backfillTimer) {
		clearTimeout(_backfillTimer);
		_backfillTimer = null;
	}
}

function scheduleBackfill(): void {
	if (_backfillTimer) return;
	_backfillTimer = setTimeout(() => {
		_backfillTimer = null;
		void runBackfill();
	}, _backfillDelayMs);
	// Do not keep the process alive solely for backfill.
	_backfillTimer.unref();
}

async function runBackfill(): Promise<void> {
	if (_backfillRunning || !_store) return;
	const store = _store;
	_backfillRunning = true;
	let moreWork = false;
	try {
		const pending = (await store.getIndexHealth()).needsEmbedding;
		if (pending <= 0) {
			// Nothing to embed. This pass makes no inference call, so it cannot confirm the
			// endpoint recovered — leave _degraded unchanged (see its invariant above). The
			// next successful live search clears it.
			_backfillDelayMs = BACKFILL_MIN_MS;
			return;
		}
		await store.embed();
		// Success: the endpoint is reachable. Reset backoff and re-check for more work.
		_degraded = false;
		_backfillDelayMs = BACKFILL_MIN_MS;
		moreWork = (await store.getIndexHealth()).needsEmbedding > 0;
	} catch (e) {
		// Still down — back off (capped) and retry.
		_degraded = true;
		_backfillDelayMs = Math.min(_backfillDelayMs * 2, BACKFILL_MAX_MS);
		console.warn(`[qmd] embedding backfill retry in ${_backfillDelayMs}ms:`, e);
		moreWork = true;
	} finally {
		_backfillRunning = false;
		// Reschedule from one place so a run skipped by the _backfillRunning guard (a timer
		// that fired mid-pass) never loses the next tick.
		if (moreWork) scheduleBackfill();
	}
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
		'SELECT id, modified_at FROM file_index WHERE machine_id = ? AND hash = ?',
	);
	const archiveStmt = _db?.query(
		`SELECT id, url, title, archived_at FROM archives
		 WHERE id = ? AND quality = 'good' AND superseded_by IS NULL AND deleted_at IS NULL`,
	);
	const annotationStmt = _db?.query(
		'SELECT id, target_kind, target_id, selection_text, comment, created_at, updated_at FROM annotations WHERE id = ?',
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
			} catch (e) {
				// ENOENT is expected — the file can vanish between index and search; modified_at
				// stays ''. Anything else (permissions, I/O) is unexpected, so surface it.
				if ((e as NodeJS.ErrnoException).code !== 'ENOENT') {
					console.warn(`[qmd] statSync failed for working/${slug}.md:`, e);
				}
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
			const fileRow = fileStmt?.get(machine_id, hash) as { id: number; modified_at: string } | null;
			if (!fileRow) return [];
			return [
				{
					id: fileRow.id,
					score: r.score,
					snippet: r.bestChunk,
					body: r.body,
					path: r.displayPath,
					kind: 'local-file' as const,
					machine_id,
					modified_at: fileRow.modified_at,
				},
			];
		}
		if (collection === 'archives') {
			const id = parseInt(basename(relPath, '.md'), 10);
			if (isNaN(id)) return [];
			const archiveRow = archiveStmt?.get(id) as {
				id: number;
				url: string;
				title: string | null;
				archived_at: string;
			} | null;
			if (!archiveRow) return [];
			return [
				{
					id,
					score: r.score,
					snippet: r.bestChunk,
					body: r.body,
					path: archiveRow.url,
					kind: 'archive' as const,
					url: archiveRow.url,
					title: archiveRow.title,
					modified_at: archiveRow.archived_at,
				},
			];
		}
		if (collection === 'capture-attachments') {
			const id = parseInt(basename(relPath, '.md'), 10);
			if (isNaN(id)) return [];
			const attRow = _db
				?.query('SELECT capture_id, filename, created_at FROM capture_attachments WHERE id = ?')
				.get(id) as { capture_id: number; filename: string; created_at: string } | null;
			if (!attRow) return [];
			return [
				{
					id,
					score: r.score,
					snippet: r.bestChunk,
					body: r.body,
					path: r.displayPath,
					kind: 'capture-attachment' as const,
					capture_id: attRow.capture_id,
					filename: attRow.filename,
					modified_at: attRow.created_at,
				},
			];
		}
		if (collection === 'working-attachments') {
			const id = parseInt(basename(relPath, '.md'), 10);
			if (isNaN(id)) return [];
			const attRow = _db
				?.query('SELECT slug, filename, created_at FROM working_attachments WHERE id = ?')
				.get(id) as { slug: string; filename: string; created_at: string } | null;
			if (!attRow) return [];
			return [
				{
					id,
					score: r.score,
					snippet: r.bestChunk,
					body: r.body,
					path: r.displayPath,
					kind: 'working-attachment' as const,
					slug: attRow.slug,
					filename: attRow.filename,
					modified_at: attRow.created_at,
				},
			];
		}
		if (collection === 'annotations') {
			const id = basename(relPath, '.md');
			const annotationRow = annotationStmt?.get(id) as AnnotationData | null;
			if (!annotationRow) return [];
			return [
				{
					id: annotationRow.id,
					score: r.score,
					snippet: r.bestChunk,
					body: r.body,
					path: r.displayPath,
					kind: 'annotation' as const,
					title: `Annotation on ${annotationRow.target_kind} ${annotationRow.target_id}`,
					target_kind: annotationRow.target_kind,
					target_id: annotationRow.target_id,
					annotation_id: annotationRow.id,
					modified_at: annotationRow.updated_at,
				},
			];
		}
		return [];
	});
}

export interface SearchResponse {
	results: SearchResult[];
	/** True when results came from the BM25 keyword-only fallback (endpoint unavailable). */
	degraded: boolean;
}

/**
 * Single adaptive search path. Runs the full-quality pipeline (LLM query expansion +
 * multi-signal retrieval + LLM rerank) through the remote endpoint. If the endpoint is
 * unavailable (circuit breaker open / request failure), it falls back to BM25 keyword-only
 * search so results stay available — never running rerank/expansion locally — and reports
 * `degraded: true`.
 */
export async function search(q: string): Promise<SearchResponse> {
	if (!_store) {
		if (_initFailed)
			console.warn('[qmd] search called but initSearch failed — returning empty results');
		else console.info('[qmd] search called before init completed — returning empty results');
		return { results: [], degraded: _degraded };
	}
	const store = _store;
	let hits: Parameters<typeof mapResults>[0];
	try {
		// single-query form — QMD auto-expands, retrieves, and reranks via the remote endpoint.
		// Only the retrieval call is guarded: mapping/DB errors below are real bugs and must
		// surface, not masquerade as a degraded endpoint.
		hits = await store.search({ query: q, limit: 20 });
	} catch (e) {
		// Remote inference unavailable: serve BM25 keyword-only results. This keeps search up
		// during an outage; newly-captured (lexically-indexed) docs are findable immediately.
		_degraded = true;
		scheduleBackfill();
		console.warn('[qmd] full-quality search unavailable — serving keyword-only (BM25):', e);
		return { results: await bm25Fallback(store, q), degraded: true };
	}
	_degraded = false;
	return { results: mapResults(hits), degraded: false };
}

/** Run a BM25 keyword-only search and adapt its rows into mapped SearchResults. */
async function bm25Fallback(store: QMDStore, q: string): Promise<SearchResult[]> {
	const lex = await store.searchLex(q, { limit: 20 });
	const hits = lex.map((r) => {
		const body = r.body ?? '';
		return {
			file: r.filepath,
			score: r.score,
			bestChunk: extractSnippet(body, q).snippet || body.slice(0, 200),
			body,
			displayPath: r.displayPath,
		};
	});
	return mapResults(hits);
}

/**
 * Related-items retrieval for the lateral panel. Unlike the search box, this is fed a
 * document body (not a short query), so it deliberately skips LLM query-expansion and
 * rerank — running expansion on a document blob is wasteful and the expansion model is
 * tuned for short queries. It uses a lightweight lex+vec retrieval (rerank disabled) and,
 * when the endpoint is down, degrades to BM25 keyword-only.
 */
export async function searchRelated(q: string): Promise<SearchResponse> {
	if (!_store) {
		if (_initFailed)
			console.warn('[qmd] searchRelated called but initSearch failed — returning empty results');
		else console.info('[qmd] searchRelated called before init completed — returning empty results');
		return { results: [], degraded: _degraded };
	}
	const store = _store;
	// Document content is passed as pre-expanded queries to structuredSearch, which rejects
	// newlines, unbalanced quotes, and negation dashes — normalize before sending.
	const singleLine = q.replace(/[\r\n]+/g, ' ').trim();
	const quoteCount = (singleLine.match(/"/g) ?? []).length;
	const lexQuery = quoteCount % 2 === 0 ? singleLine : singleLine.replace(/"/g, '');
	const vecQuery = singleLine.replace(/(^|\s)-(?=[\w"])/g, '$1');
	let hits: Parameters<typeof mapResults>[0];
	try {
		// Only the retrieval call is guarded so mapping/DB errors still surface as real errors.
		hits = await store.search({
			queries: [
				{ type: 'lex', query: lexQuery },
				{ type: 'vec', query: vecQuery },
			],
			rerank: false,
			limit: 20,
		});
	} catch (e) {
		// The vec query needs remote embedding; on outage fall back to BM25 keyword-only.
		_degraded = true;
		scheduleBackfill();
		console.warn('[qmd] related-items search unavailable — serving keyword-only (BM25):', e);
		return { results: await bm25Fallback(store, lexQuery), degraded: true };
	}
	_degraded = false;
	return { results: mapResults(hits), degraded: false };
}
