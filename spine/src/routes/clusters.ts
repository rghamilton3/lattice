import { Elysia, t } from 'elysia';
import { basename } from 'node:path';
import type { Database } from 'bun:sqlite';
import { readWorking, WorkingNotFoundError } from '../working';

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
		return { snippet: row.text.slice(0, 200), title: row.text.slice(0, 60) };
	}

	if (targetKind === 'working') {
		try {
			const doc = readWorking(targetId);
			const body = doc.content.replace(/^---[\s\S]*?---\n/, '').trimStart();
			return { snippet: body.slice(0, 200), title: doc.title || targetId };
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

export const clusterRoutes = (db: Database) =>
	new Elysia({ prefix: '/api' })
		// IMPORTANT: register /cluster/doc/:kind/:target_id BEFORE /cluster/:id
		// to prevent Elysia from matching "doc" as a cluster id.
		.get(
			'/cluster/doc/:kind/:target_id',
			({ params }) => {
				const row = db
					.query<{ cluster_id: number }, [string, string]>(
						`SELECT cluster_id FROM cluster_memberships
						 WHERE target_kind = ? AND target_id = ?
						 LIMIT 1`,
					)
					.get(params.kind, params.target_id);
				return { clusterId: row?.cluster_id ?? null };
			},
			{
				params: t.Object({ kind: t.String(), target_id: t.String() }),
			},
		)
		.get(
			'/cluster/:id',
			({ params, set }) => {
				const clusterId = parseInt(params.id, 10);
				if (isNaN(clusterId)) {
					set.status = 404;
					return { error: 'Not found' };
				}

				const cluster = db
					.query<
						{ id: number; run_at: string },
						[number]
					>(`SELECT id, run_at FROM clusters WHERE id = ?`)
					.get(clusterId);
				if (!cluster) {
					set.status = 404;
					return { error: 'Not found' };
				}

				const memberRows = db
					.query<
						{ target_kind: string; target_id: string },
						[number]
					>(`SELECT target_kind, target_id FROM cluster_memberships WHERE cluster_id = ?`)
					.all(clusterId);

				const members = memberRows.map((m) => {
					const { snippet, title } = getSnippetAndTitle(db, m.target_kind, m.target_id);
					return { target_kind: m.target_kind, target_id: m.target_id, title, snippet };
				});

				return { id: cluster.id, run_at: cluster.run_at, members };
			},
			{ params: t.Object({ id: t.String() }) },
		);
