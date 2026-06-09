import { Elysia, t } from 'elysia';
import type { Database } from 'bun:sqlite';
import { mkdirSync, writeFileSync, unlinkSync, existsSync, realpathSync } from 'node:fs';
import { realpath } from 'node:fs/promises';
import { join, sep } from 'node:path';
import type { CaptureAttachmentRow, AttachmentDescriptionRow } from '../db/rows';
import { writeAttachmentIndex, refreshIndex, attachmentsMdDir } from '../search';
import { queueAttachment } from '../extraction-queue';

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
						'SELECT id, capture_id, filename, content_type, size_bytes, stored_path, upload_source, created_at, extraction_status FROM capture_attachments WHERE capture_id = ? ORDER BY created_at ASC',
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
               (capture_id, signal_id, content_type, filename, size_bytes, stored_path, upload_source, created_at, extraction_status, extracted_text)
             VALUES (?, '', ?, ?, ?, '', 'browser', ?, 'pending', '') RETURNING id`,
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
				queueAttachment(row.id, 'capture', join(attachmentsDir, row.stored_path), contentType, db);

				return {
					id: row.id,
					capture_id: captureId,
					filename,
					content_type: contentType,
					size_bytes: bytes.length,
					stored_path: row.stored_path,
					upload_source: 'browser',
					created_at: now,
					extraction_status: 'pending',
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
		)
		.get(
			'/api/captures/:id/attachments/:attId/description',
			({ params, set }) => {
				const captureId = parseInt(params.id, 10);
				const attId = parseInt(params.attId, 10);
				if (isNaN(captureId) || isNaN(attId)) {
					set.status = 400;
					return { error: 'Invalid id' };
				}

				const att = db
					.query(
						'SELECT extraction_status FROM capture_attachments WHERE id = ? AND capture_id = ?',
					)
					.get(attId, captureId) as { extraction_status: string } | null;
				if (!att) {
					set.status = 404;
					return { error: 'Not found' };
				}
				if (att.extraction_status !== 'dark') {
					set.status = 409;
					return { error: 'Attachment is not dark' };
				}

				const desc = db
					.query(
						`SELECT * FROM attachment_descriptions
					 WHERE attachment_kind = 'capture' AND attachment_id = ? AND supersedes IS NULL`,
					)
					.get(attId) as AttachmentDescriptionRow | null;
				if (!desc) {
					set.status = 404;
					return { error: 'No description yet' };
				}
				return { ...desc, confirmed: desc.confirmed === 1 };
			},
			{ params: t.Object({ id: t.String(), attId: t.String() }) },
		)
		.patch(
			'/api/captures/:id/attachments/:attId/description',
			({ params, body, set }) => {
				const captureId = parseInt(params.id, 10);
				const attId = parseInt(params.attId, 10);
				if (isNaN(captureId) || isNaN(attId)) {
					set.status = 400;
					return { error: 'Invalid id' };
				}

				const { final_text, confirmed } = body;
				if (final_text === undefined && confirmed === undefined) {
					set.status = 400;
					return { error: 'Nothing to update' };
				}
				if (final_text !== undefined && final_text.trim() === '') {
					set.status = 400;
					return { error: 'final_text cannot be empty' };
				}

				const att = db
					.query(
						'SELECT extraction_status FROM capture_attachments WHERE id = ? AND capture_id = ?',
					)
					.get(attId, captureId) as { extraction_status: string } | null;
				if (!att) {
					set.status = 404;
					return { error: 'Not found' };
				}

				const desc = db
					.query(
						`SELECT * FROM attachment_descriptions
					 WHERE attachment_kind = 'capture' AND attachment_id = ? AND supersedes IS NULL`,
					)
					.get(attId) as AttachmentDescriptionRow | null;
				if (!desc) {
					set.status = 404;
					return { error: 'No description' };
				}

				const updates: string[] = [];
				const vals: unknown[] = [];
				if (final_text !== undefined) {
					updates.push('final_text = ?');
					vals.push(final_text);
				}
				if (confirmed !== undefined) {
					updates.push('confirmed = ?');
					vals.push(confirmed ? 1 : 0);
				}
				vals.push(desc.id);
				db.prepare(`UPDATE attachment_descriptions SET ${updates.join(', ')} WHERE id = ?`).run(
					...(vals as (string | number | boolean | null)[]),
				);

				if (final_text !== undefined) {
					const row = db
						.query(
							'SELECT id, capture_id, filename, content_type, size_bytes, created_at FROM capture_attachments WHERE id = ?',
						)
						.get(attId) as {
						id: number;
						capture_id: number;
						filename: string;
						content_type: string;
						size_bytes: number;
						created_at: string;
					} | null;
					if (row) {
						writeAttachmentIndex(
							row.id,
							row.capture_id,
							row.filename,
							row.content_type,
							row.size_bytes,
							row.created_at,
							final_text,
						);
						refreshIndex();
					}
				}

				const updated = db
					.query('SELECT * FROM attachment_descriptions WHERE id = ?')
					.get(desc.id) as AttachmentDescriptionRow;
				return { ...updated, confirmed: updated.confirmed === 1 };
			},
			{
				params: t.Object({ id: t.String(), attId: t.String() }),
				body: t.Object({ final_text: t.Optional(t.String()), confirmed: t.Optional(t.Boolean()) }),
			},
		);
};
