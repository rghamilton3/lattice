import type { Database } from 'bun:sqlite';
import { createArchive, extractArchiveText, type ArchiveRow } from './archives';
import { archiveNotificationPosture, emitArchiveAttention } from './archiveEvents';
import { classifyArchive } from './archiveQuality';
import { refreshIndex } from './search';

export type ArchiveJobStatus = 'queued' | 'running' | 'stored' | 'failed';

export interface ArchiveJob {
	id: string;
	url: string;
	source: string | null;
	why_saved: string | null;
	created_at: string;
	started_at: string | null;
	finished_at: string | null;
	status: ArchiveJobStatus;
	archive_id: number | null;
	error: string | null;
}

const jobs = new Map<string, ArchiveJob>();
// URL archive jobs are intentionally volatile for v1; process restarts drop queued work.
const queue: ArchiveJob[] = [];
let running = false;
let seq = 0;

export function enqueueArchiveUrlJob(
	db: Database,
	archiveDir: string,
	input: { url: string; source?: string | null; why_saved?: string | null },
): ArchiveJob {
	const now = new Date().toISOString();
	const job: ArchiveJob = {
		id: `archive-${now.slice(0, 10).replace(/-/g, '')}-${String(++seq).padStart(6, '0')}`,
		url: input.url,
		source: input.source ?? null,
		why_saved: input.why_saved ?? null,
		created_at: now,
		started_at: null,
		finished_at: null,
		status: 'queued',
		archive_id: null,
		error: null,
	};
	jobs.set(job.id, job);
	queue.push(job);
	void drainQueue(db, archiveDir);
	return job;
}

export function getArchiveJob(id: string): ArchiveJob | null {
	return jobs.get(id) ?? null;
}

async function drainQueue(db: Database, archiveDir: string): Promise<void> {
	if (running) return;
	running = true;
	try {
		while (queue.length > 0) {
			const job = queue.shift()!;
			await runJob(db, archiveDir, job);
		}
	} finally {
		running = false;
	}
}

async function runJob(db: Database, archiveDir: string, job: ArchiveJob): Promise<void> {
	job.status = 'running';
	job.started_at = new Date().toISOString();
	try {
		const html = await runMonolith(job.url);
		const text = extractArchiveText(html);
		const quality = classifyArchive(html, text);
		const row = createArchive(db, {
			url: job.url,
			html,
			capturedVia: 'monolith',
			source: job.source,
			whySaved: job.why_saved,
			quality: quality.quality,
			archiveDir,
		}) as ArchiveRow;
		job.archive_id = row.id;
		job.status = 'stored';
		refreshIndex();
		if (row.quality !== 'good') {
			emitArchiveAttention(archiveNotificationPosture(), {
				type: 'archive_recapture',
				title: row.title ?? row.url,
				url: row.url,
				archive_id: row.id,
				quality: row.quality,
			});
		}
	} catch (error) {
		job.error = error instanceof Error ? error.message : String(error);
		try {
			const row = createArchive(db, {
				url: job.url,
				html: `<html><body>Archive failed for ${escapeHtml(job.url)}: ${escapeHtml(job.error)}</body></html>`,
				capturedVia: 'monolith',
				source: job.source,
				whySaved: job.why_saved,
				quality: 'failed',
				archiveDir,
			});
			job.archive_id = row.id;
			emitArchiveAttention(archiveNotificationPosture(), {
				type: 'archive_recapture',
				title: row.title ?? row.url,
				url: row.url,
				archive_id: row.id,
				quality: row.quality,
			});
		} catch {
			// The job record still carries the failure if even the failure row cannot be stored.
		}
		job.status = 'failed';
	} finally {
		job.finished_at = new Date().toISOString();
	}
}

async function runMonolith(url: string): Promise<string> {
	const proc = Bun.spawn(['monolith', url], { stdout: 'pipe', stderr: 'pipe' });
	const timeout = setTimeout(() => proc.kill(), 30_000);
	const [stdout, stderr, exitCode] = await Promise.all([
		new Response(proc.stdout).text(),
		new Response(proc.stderr).text(),
		proc.exited,
	]);
	clearTimeout(timeout);
	if (exitCode !== 0) throw new Error(stderr.trim() || `monolith exited ${exitCode}`);
	if (stdout.trim().length === 0) throw new Error('monolith produced empty output');
	return stdout;
}

function escapeHtml(value: string): string {
	return value.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}
