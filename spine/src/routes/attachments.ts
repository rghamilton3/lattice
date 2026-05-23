import { Elysia, t } from 'elysia';
import type { Database } from 'bun:sqlite';
import { mkdirSync, writeFileSync, unlinkSync, existsSync, realpathSync } from 'node:fs';
import { realpath } from 'node:fs/promises';
import { join, sep } from 'node:path';
import type { CaptureAttachmentRow } from '../db/rows';
import { writeAttachmentIndex, refreshIndex, attachmentsMdDir } from '../search';

export interface AttachmentRoutesOptions {
	attachmentsDir: string;
}

export const attachmentRoutes = (db: Database, { attachmentsDir }: AttachmentRoutesOptions) => {
	// Resolve the base dir once so symlink-swap checks compare canonical paths.
	let canonicalBase: string;
	try {
		canonicalBase = realpathSync(attachmentsDir);
	} catch {
		canonicalBase = attachmentsDir;
	}

	return new Elysia()
		.get(
			'/api/captures/:id/attachments',
			({ params, set }) => {
				const captureId = parseInt(params.id, 10);
				if (isNaN(captureId)) {
					set.status = 400;
					return { error: 'Invalid id' };
				}
				const capture = db.query('SELECT id FROM captures WHERE id = ?').get(captureId);
				if (!capture) {
					set.status = 404;
					return { error: 'Not found' };
				}
				return db
					.query(
						'SELECT id, capture_id, filename, content_type, size_bytes, stored_path, upload_source, created_at FROM capture_attachments WHERE capture_id = ? ORDER BY created_at ASC',
					)
					.all(captureId) as CaptureAttachmentRow[];
			},
			{ params: t.Object({ id: t.String() }) },
		)
		.post(
			'/api/captures/:id/attachments',
			async ({ params, request, set }) => {
				const captureId = parseInt(params.id, 10);
				if (isNaN(captureId)) {
					set.status = 400;
					return { error: 'Invalid id' };
				}
				const capture = db.query('SELECT id FROM captures WHERE id = ?').get(captureId);
				if (!capture) {
					set.status = 404;
					return { error: 'Not found' };
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

				// Atomic: INSERT with placeholder stored_path, write binary, UPDATE stored_path.
				// If writeFileSync throws, the transaction rolls back both SQL statements,
				// keeping the DB consistent. writeAttachmentIndex runs after the transaction
				// so a search-index write failure never orphans the DB row.
				const row = db.transaction(() => {
					const inserted = db
						.prepare(
							`INSERT INTO capture_attachments
               (capture_id, signal_id, content_type, filename, size_bytes, stored_path, upload_source, created_at)
             VALUES (?, '', ?, ?, ?, '', 'browser', ?) RETURNING id`,
						)
						.get(captureId, contentType, filename, bytes.length, now) as { id: number };

					const dir = join(attachmentsDir, String(captureId));
					mkdirSync(dir, { recursive: true });
					writeFileSync(join(dir, String(inserted.id)), bytes);

					const storedPath = `${captureId}/${inserted.id}`;
					db.prepare('UPDATE capture_attachments SET stored_path = ? WHERE id = ?').run(
						storedPath,
						inserted.id,
					);

					return { id: inserted.id, stored_path: storedPath };
				})();

				writeAttachmentIndex(row.id, captureId, filename, contentType, bytes.length, now);
				refreshIndex();

				return {
					id: row.id,
					capture_id: captureId,
					filename,
					content_type: contentType,
					size_bytes: bytes.length,
					stored_path: row.stored_path,
					upload_source: 'browser',
					created_at: now,
				};
			},
			{ params: t.Object({ id: t.String() }) },
		)
		.get(
			'/api/captures/:id/attachments/:attId/raw',
			async ({ params, set }) => {
				const captureId = parseInt(params.id, 10);
				const attId = parseInt(params.attId, 10);
				if (isNaN(captureId) || isNaN(attId)) {
					set.status = 400;
					return 'Invalid id';
				}

				const row = db
					.query(
						'SELECT stored_path, content_type, filename FROM capture_attachments WHERE id = ? AND capture_id = ?',
					)
					.get(attId, captureId) as Pick<
					CaptureAttachmentRow,
					'stored_path' | 'content_type' | 'filename'
				> | null;
				if (!row) {
					set.status = 404;
					return 'Not found';
				}

				const fullPath = join(attachmentsDir, row.stored_path);

				// Symlink-swap defense: stored path must equal its canonical form.
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
						console.warn(`[attachments] ELOOP resolving ${fullPath}`);
						set.status = 403;
						return 'Forbidden';
					}
					console.error(`[attachments] realpath failed (${code ?? 'unknown'}) for ${fullPath}:`, e);
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
			{ params: t.Object({ id: t.String(), attId: t.String() }) },
		)
		.delete(
			'/api/captures/:id/attachments/:attId',
			({ params, set }) => {
				const captureId = parseInt(params.id, 10);
				const attId = parseInt(params.attId, 10);
				if (isNaN(captureId) || isNaN(attId)) {
					set.status = 400;
					return { error: 'Invalid id' };
				}

				const row = db
					.query('SELECT stored_path FROM capture_attachments WHERE id = ? AND capture_id = ?')
					.get(attId, captureId) as Pick<CaptureAttachmentRow, 'stored_path'> | null;
				if (!row) {
					set.status = 404;
					return { error: 'Not found' };
				}

				db.prepare('DELETE FROM capture_attachments WHERE id = ?').run(attId);

				// Best-effort cleanup: remove binary and search index files.
				// The DB row is already gone; log failures but don't surface them.
				try {
					const binPath = join(attachmentsDir, row.stored_path);
					if (existsSync(binPath)) unlinkSync(binPath);
				} catch (e) {
					console.warn(`[attachments] failed to delete binary for att ${attId}:`, e);
				}
				try {
					const mdPath = join(attachmentsMdDir(), `${attId}.md`);
					if (existsSync(mdPath)) unlinkSync(mdPath);
				} catch (e) {
					console.warn(`[attachments] failed to delete index file for att ${attId}:`, e);
				}
				refreshIndex();

				return {};
			},
			{ params: t.Object({ id: t.String(), attId: t.String() }) },
		);
};
