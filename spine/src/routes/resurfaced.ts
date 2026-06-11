import { Elysia, t } from 'elysia';
import { basename } from 'node:path';
import type { Database } from 'bun:sqlite';
import { readWorking, WorkingNotFoundError } from '../working';

interface SurfacedRow {
	id: number;
	target_kind: string;
	target_id: string;
	reason: string | null;
}

function getSnippetAndTitle(
	db: Database,
	targetKind: string,
	targetId: string,
): { snippet: string; title: string } {
	if (targetKind === 'capture') {
		const row = db
			.query<{ text: string }, [number]>(`SELECT text FROM captures WHERE id = ?`)
			.get(parseInt(targetId, 10));
		if (!row) return { snippet: '', title: '' };
		const snippet = row.text.slice(0, 200);
		const title = row.text.slice(0, 60);
		return { snippet, title };
	}

	if (targetKind === 'working') {
		try {
			const doc = readWorking(targetId);
			const body = doc.content.replace(/^---[\s\S]*?---\n/, '').trimStart();
			const snippet = body.slice(0, 200);
			const title = doc.title || targetId;
			return { snippet, title };
		} catch (e) {
			if (e instanceof WorkingNotFoundError) return { snippet: '', title: targetId };
			throw e;
		}
	}

	if (targetKind === 'local-file') {
		const row = db
			.query<{ text: string }, [string]>(`SELECT text FROM file_index WHERE path = ?`)
			.get(targetId);
		if (!row) return { snippet: '', title: basename(targetId) };
		return { snippet: row.text.slice(0, 200), title: basename(targetId) };
	}

	return { snippet: '', title: '' };
}

export const resurfacedRoutes = (db: Database) =>
	new Elysia({ prefix: '/api' })
		.get('/resurfaced', () => {
			const rows = db
				.query<SurfacedRow, []>(
					`SELECT id, target_kind, target_id, reason
					 FROM surfaced
					 WHERE DATE(surfaced_at,'localtime') = DATE('now','localtime')
					   AND dismissed_at IS NULL
					 ORDER BY id`,
				)
				.all();

			const items = rows.map((row) => {
				const { snippet, title } = getSnippetAndTitle(db, row.target_kind, row.target_id);
				return {
					id: row.id,
					target_kind: row.target_kind,
					target_id: row.target_id,
					reason: row.reason,
					snippet,
					title,
				};
			});

			return { items };
		})
		.post(
			'/resurfaced/:id/dismiss',
			({ params, set }) => {
				const id = parseInt(params.id, 10);
				const now = new Date().toISOString();
				const result = db
					.query<
						{ id: number },
						[string, number]
					>(`UPDATE surfaced SET dismissed_at = ? WHERE id = ? RETURNING id`)
					.get(now, id);
				if (!result) {
					set.status = 404;
					return { error: 'Not found' };
				}
				return { ok: true };
			},
			{ params: t.Object({ id: t.String() }) },
		);
