import { Elysia, t } from 'elysia';
import type { Database } from 'bun:sqlite';
import { realpath } from 'node:fs/promises';
import type { FileIndexRow } from '../db/rows';

type FileListRow = Pick<FileIndexRow, 'id' | 'machine_id' | 'path' | 'mime_type' | 'modified_at'>;

interface FileCursor {
	v: 1;
	kind: 'files';
	modified_at: string;
	id: number;
}

function encodeCursor(row: Pick<FileIndexRow, 'modified_at' | 'id'>): string {
	return Buffer.from(
		JSON.stringify({ v: 1, kind: 'files', modified_at: row.modified_at, id: row.id }),
	).toString('base64url');
}

function parseCursor(value: string | undefined): FileCursor | null | undefined {
	if (value === undefined) return undefined;
	if (!value) return null;
	try {
		const parsed = JSON.parse(
			Buffer.from(value, 'base64url').toString('utf8'),
		) as Partial<FileCursor>;
		if (
			parsed.v !== 1 ||
			parsed.kind !== 'files' ||
			typeof parsed.modified_at !== 'string' ||
			typeof parsed.id !== 'number' ||
			!Number.isInteger(parsed.id) ||
			parsed.id <= 0
		) {
			return null;
		}
		return parsed as FileCursor;
	} catch {
		return null;
	}
}

function parsePositiveId(value: string): number | null {
	if (!/^\d+$/.test(value)) return null;
	const id = Number(value);
	return Number.isSafeInteger(id) && id > 0 ? id : null;
}

export const filesRoutes = (db: Database) =>
	new Elysia()
		.get(
			'/api/files',
			({ query, set }) => {
				const raw = query.limit ? Number(query.limit) : 100;
				const limit = Math.min(Number.isFinite(raw) && raw > 0 ? raw : 100, 500);
				const cursor = parseCursor(query.cursor);
				if (cursor === null) {
					set.status = 400;
					return { error: 'Invalid cursor' };
				}

				const params: Array<string | number> = [];
				const where = cursor ? 'WHERE (modified_at < ? OR (modified_at = ? AND id < ?))' : '';
				if (cursor) params.push(cursor.modified_at, cursor.modified_at, cursor.id);
				params.push(limit + 1);
				const rows = db
					.query(
						`SELECT id, machine_id, path, mime_type, modified_at FROM file_index ${where} ORDER BY modified_at DESC, id DESC LIMIT ?`,
					)
					.all(...params) as FileListRow[];
				const items = rows.slice(0, limit);
				return {
					items,
					next_cursor: rows.length > limit ? encodeCursor(items[items.length - 1]) : null,
				};
			},
			{ query: t.Object({ limit: t.Optional(t.String()), cursor: t.Optional(t.String()) }) },
		)
		.get(
			'/api/files/:id',
			({ params, set }) => {
				const id = parsePositiveId(params.id);
				if (id === null) {
					set.status = 400;
					return { error: 'Invalid id' };
				}
				const row = db
					.query('SELECT * FROM file_index WHERE id = ?')
					.get(id) as FileIndexRow | null;
				if (!row) {
					set.status = 404;
					return { error: 'Not found' };
				}
				return row;
			},
			{ params: t.Object({ id: t.String() }) },
		)
		.get(
			'/api/files/:id/raw',
			async ({ params, set }) => {
				const id = parsePositiveId(params.id);
				if (id === null) {
					set.status = 400;
					return 'Invalid id';
				}
				const row = db.query('SELECT path, mime_type FROM file_index WHERE id = ?').get(id) as Pick<
					FileIndexRow,
					'path' | 'mime_type'
				> | null;
				if (!row) {
					set.status = 404;
					return 'Not found';
				}
				// Symlink-swap defense: stored path must equal its canonical form.
				// Discriminate realpath errors — collapsing ELOOP into 404 conflates
				// legitimate "not found" with the symlink-attack signal we're guarding.
				let resolved: string;
				try {
					resolved = await realpath(row.path);
				} catch (e) {
					const code = (e as NodeJS.ErrnoException).code;
					if (code === 'ENOENT') {
						set.status = 404;
						return 'File not found on disk';
					}
					if (code === 'ELOOP') {
						console.warn(`[files] ELOOP resolving ${row.path}`);
						set.status = 403;
						return 'Forbidden';
					}
					console.error(`[files] realpath failed (${code ?? 'unknown'}) for ${row.path}:`, e);
					set.status = 500;
					return 'Internal error';
				}
				if (resolved !== row.path) {
					set.status = 403;
					return 'Forbidden';
				}
				return new Response(Bun.file(resolved), {
					headers: { 'Content-Type': row.mime_type },
				});
			},
			{ params: t.Object({ id: t.String() }) },
		);
