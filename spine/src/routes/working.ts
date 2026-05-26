import { Elysia, t } from 'elysia';
import type { Database } from 'bun:sqlite';
import { mkdirSync, writeFileSync, unlinkSync, existsSync, realpathSync } from 'node:fs';
import { realpath } from 'node:fs/promises';
import { join, sep } from 'node:path';
import {
	WorkingNotFoundError,
	WorkingConflictError,
	listWorking,
	readWorking,
	createWorking,
	updateWorking,
	deleteWorking,
} from '../working';
import { refreshIndex, writeWorkingAttachmentIndex, deleteWorkingAttachmentIndex } from '../search';
import type { CaptureRow, FileIndexRow, WorkingAttachmentRow } from '../db/rows';

type SeedCaptureRow = Pick<CaptureRow, 'text' | 'captured_at'>;
type SeedFileRow = Pick<FileIndexRow, 'text' | 'path'>;

export interface WorkingRoutesOptions {
	attachmentsDir: string;
}

export const workingRoutes = (db: Database, { attachmentsDir }: WorkingRoutesOptions) => {
	let canonicalBase: string;
	try {
		canonicalBase = realpathSync(join(attachmentsDir, 'working'));
	} catch {
		canonicalBase = join(attachmentsDir, 'working');
	}

	return new Elysia()
		.get('/api/working', ({ set }) => {
			try {
				return listWorking();
			} catch (e) {
				console.error('[working] listWorking failed:', e);
				set.status = 500;
				return { error: 'Failed to list working docs' };
			}
		})
		.get(
			'/api/working/:slug',
			({ params, set }) => {
				try {
					return readWorking(params.slug);
				} catch (e) {
					if (e instanceof WorkingNotFoundError) {
						set.status = 404;
						return { error: 'Not found' };
					}
					console.error(`[working] readWorking failed for ${params.slug}:`, e);
					throw e;
				}
			},
			{ params: t.Object({ slug: t.String({ pattern: '^[a-z0-9-]+$' }) }) },
		)
		.post(
			'/api/working',
			async ({ body, set }) => {
				let content = body.content;

				if (body.seed_capture_id != null) {
					const row = db
						.query('SELECT text, captured_at FROM captures WHERE id = ?')
						.get(body.seed_capture_id) as SeedCaptureRow | null;
					if (!row) {
						set.status = 404;
						return { error: 'Capture not found' };
					}
					content = `# ${body.title}\n\n> Seeded from capture #${body.seed_capture_id} (${row.captured_at})\n\n${row.text}\n`;
				} else if (body.seed_file_id != null) {
					const row = db
						.query('SELECT text, path FROM file_index WHERE id = ?')
						.get(body.seed_file_id) as SeedFileRow | null;
					if (!row) {
						set.status = 404;
						return { error: 'File not found' };
					}
					content = `# ${body.title}\n\n> Seeded from file: ${row.path}\n\n${row.text}\n`;
				}

				try {
					const slug = createWorking(body.title, content);
					refreshIndex();
					return { slug };
				} catch (e) {
					if (e instanceof WorkingConflictError) {
						set.status = 409;
						return { error: 'Slug already exists' };
					}
					if (e instanceof Error && e.message.startsWith('Title produces empty slug')) {
						set.status = 400;
						return { error: 'Title must include letters or numbers' };
					}
					console.error('[working] createWorking failed:', e);
					throw e;
				}
			},
			{
				body: t.Object({
					title: t.String({ minLength: 1 }),
					content: t.Optional(t.String()),
					seed_capture_id: t.Optional(t.Integer()),
					seed_file_id: t.Optional(t.Integer()),
				}),
			},
		)
		.put(
			'/api/working/:slug',
			({ params, body, set }) => {
				try {
					updateWorking(params.slug, body.content);
					refreshIndex();
					return { ok: true };
				} catch (e) {
					if (e instanceof WorkingNotFoundError) {
						set.status = 404;
						return { error: 'Not found' };
					}
					console.error(`[working] updateWorking failed for ${params.slug}:`, e);
					throw e;
				}
			},
			{
				params: t.Object({ slug: t.String({ pattern: '^[a-z0-9-]+$' }) }),
				body: t.Object({ content: t.String() }),
			},
		)
		.delete(
			'/api/working/:slug',
			({ params, set }) => {
				try {
					deleteWorking(params.slug);
					refreshIndex();
					return { ok: true };
				} catch (e) {
					if (e instanceof WorkingNotFoundError) {
						set.status = 404;
						return { error: 'Not found' };
					}
					console.error(`[working] deleteWorking failed for ${params.slug}:`, e);
					throw e;
				}
			},
			{ params: t.Object({ slug: t.String({ pattern: '^[a-z0-9-]+$' }) }) },
		)
		.get(
			'/api/working/:slug/attachments',
			({ params, set }) => {
				// Verify the doc exists.
				try {
					readWorking(params.slug);
				} catch (e) {
					if (e instanceof WorkingNotFoundError) {
						set.status = 404;
						return { error: 'Not found' };
					}
					throw e;
				}
				return db
					.query(
						'SELECT id, slug, filename, content_type, size_bytes, stored_path, created_at FROM working_attachments WHERE slug = ? ORDER BY created_at ASC',
					)
					.all(params.slug) as WorkingAttachmentRow[];
			},
			{ params: t.Object({ slug: t.String({ pattern: '^[a-z0-9-]+$' }) }) },
		)
		.post(
			'/api/working/:slug/attachments',
			async ({ params, request, set }) => {
				try {
					readWorking(params.slug);
				} catch (e) {
					if (e instanceof WorkingNotFoundError) {
						set.status = 404;
						return { error: 'Not found' };
					}
					throw e;
				}

				let formData: FormData;
				try {
					formData = await request.formData();
				} catch {
					set.status = 400;
					return { error: 'Invalid multipart body' };
				}

				const file = formData.get('file');
				if (!(file instanceof File)) {
					set.status = 400;
					return { error: 'Missing file field' };
				}

				const filename = file.name || 'upload';
				const contentType = file.type || 'application/octet-stream';
				const bytes = Buffer.from(await file.arrayBuffer());
				const now = new Date().toISOString();
				const slug = params.slug;

				const row = db.transaction(() => {
					const inserted = db
						.prepare(
							`INSERT INTO working_attachments
               (slug, content_type, filename, size_bytes, stored_path, created_at)
             VALUES (?, ?, ?, ?, '', ?) RETURNING id`,
						)
						.get(slug, contentType, filename, bytes.length, now) as { id: number };

					const dir = join(attachmentsDir, 'working', slug);
					mkdirSync(dir, { recursive: true });
					writeFileSync(join(dir, String(inserted.id)), bytes);

					const storedPath = `working/${slug}/${inserted.id}`;
					db.prepare('UPDATE working_attachments SET stored_path = ? WHERE id = ?').run(
						storedPath,
						inserted.id,
					);

					return { id: inserted.id, stored_path: storedPath };
				})();

				writeWorkingAttachmentIndex(row.id, slug, filename, contentType, bytes.length, now);
				refreshIndex();

				return {
					id: row.id,
					slug,
					filename,
					content_type: contentType,
					size_bytes: bytes.length,
					stored_path: row.stored_path,
					created_at: now,
				};
			},
			{ params: t.Object({ slug: t.String({ pattern: '^[a-z0-9-]+$' }) }) },
		)
		.get(
			'/api/working/:slug/attachments/:attId/raw',
			async ({ params, set }) => {
				const attId = parseInt(params.attId, 10);
				if (isNaN(attId)) {
					set.status = 400;
					return 'Invalid id';
				}

				const row = db
					.query(
						'SELECT stored_path, content_type, filename FROM working_attachments WHERE id = ? AND slug = ?',
					)
					.get(attId, params.slug) as Pick<
					WorkingAttachmentRow,
					'stored_path' | 'content_type' | 'filename'
				> | null;
				if (!row) {
					set.status = 404;
					return 'Not found';
				}

				const fullPath = join(attachmentsDir, row.stored_path);

				let resolved: string;
				try {
					resolved = await realpath(fullPath);
				} catch (e) {
					const code = (e as NodeJS.ErrnoException).code;
					if (code === 'ENOENT') {
						set.status = 404;
						return 'File not found on disk';
					}
					if (code === 'ELOOP') {
						console.warn(`[working-att] ELOOP resolving ${fullPath}`);
						set.status = 403;
						return 'Forbidden';
					}
					console.error(`[working-att] realpath failed (${code ?? 'unknown'}) for ${fullPath}:`, e);
					set.status = 500;
					return 'Internal error';
				}
				if (!resolved.startsWith(canonicalBase + sep)) {
					set.status = 403;
					return 'Forbidden';
				}

				const safeFilename = row.filename.replace(/[^a-zA-Z0-9._-]/g, '_');
				return new Response(Bun.file(resolved), {
					headers: {
						'Content-Type': row.content_type,
						'Content-Disposition': `attachment; filename="${safeFilename}"`,
						'X-Content-Type-Options': 'nosniff',
					},
				});
			},
			{ params: t.Object({ slug: t.String({ pattern: '^[a-z0-9-]+$' }), attId: t.String() }) },
		)
		.delete(
			'/api/working/:slug/attachments/:attId',
			({ params, set }) => {
				const attId = parseInt(params.attId, 10);
				if (isNaN(attId)) {
					set.status = 400;
					return { error: 'Invalid id' };
				}

				const row = db
					.query('SELECT stored_path FROM working_attachments WHERE id = ? AND slug = ?')
					.get(attId, params.slug) as Pick<WorkingAttachmentRow, 'stored_path'> | null;
				if (!row) {
					set.status = 404;
					return { error: 'Not found' };
				}

				db.prepare('DELETE FROM working_attachments WHERE id = ?').run(attId);

				try {
					const binPath = join(attachmentsDir, row.stored_path);
					if (existsSync(binPath)) unlinkSync(binPath);
				} catch (e) {
					console.warn(`[working-att] failed to delete binary for att ${attId}:`, e);
				}
				try {
					deleteWorkingAttachmentIndex(attId);
				} catch (e) {
					console.warn(`[working-att] failed to delete index file for att ${attId}:`, e);
				}
				refreshIndex();

				return {};
			},
			{ params: t.Object({ slug: t.String({ pattern: '^[a-z0-9-]+$' }), attId: t.String() }) },
		);
};
