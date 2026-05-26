import { Elysia, t } from 'elysia';
import type { Database } from 'bun:sqlite';
import {
	applyArchiveAction,
	getArchive,
	readArchiveArtifact,
	type ArchiveAction,
} from '../archives';

const VALID_ACTIONS = new Set<ArchiveAction>([
	'keep',
	'archive',
	'recapture',
	'delete',
	'skip',
	'auto-kept',
]);
const RAW_ARCHIVE_CSP =
	"sandbox; default-src 'none'; img-src data: blob: https: http:; style-src 'unsafe-inline'";

function isArchiveAction(action: string): action is ArchiveAction {
	return VALID_ACTIONS.has(action as ArchiveAction);
}

function parseRouteId(value: string): number | null {
	const id = Number(value);
	return Number.isInteger(id) && id > 0 ? id : null;
}

export const archivesRoutes = (db: Database, { archiveDir }: { archiveDir: string }) =>
	new Elysia()
		.get(
			'/api/archives/:id',
			({ params, set }) => {
				const id = parseRouteId(params.id);
				if (id === null) {
					set.status = 400;
					return { error: 'Invalid id' };
				}
				const row = getArchive(db, id);
				if (!row) {
					set.status = 404;
					return { error: 'Not found' };
				}
				return row;
			},
			{ params: t.Object({ id: t.String() }) },
		)
		.get(
			'/api/archives/:id/raw',
			({ params, set }) => {
				const id = parseRouteId(params.id);
				if (id === null) {
					set.status = 400;
					return { error: 'Invalid id' };
				}
				const row = getArchive(db, id);
				if (!row) {
					set.status = 404;
					return { error: 'Not found' };
				}
				try {
					return new Response(readArchiveArtifact(row, archiveDir), {
						headers: {
							'Content-Type': 'text/html; charset=utf-8',
							'Content-Security-Policy': RAW_ARCHIVE_CSP,
							'X-Content-Type-Options': 'nosniff',
							'Referrer-Policy': 'no-referrer',
						},
					});
				} catch {
					set.status = 404;
					return { error: 'Archive artifact missing' };
				}
			},
			{ params: t.Object({ id: t.String() }) },
		)
		.post(
			'/api/archives/:id/action',
			({ params, body, set }) => {
				const id = parseRouteId(params.id);
				if (id === null) {
					set.status = 400;
					return { error: 'Invalid id' };
				}
				if (!isArchiveAction(body.action)) {
					set.status = 422;
					return { error: 'Invalid action' };
				}
				const result = applyArchiveAction(db, id, body.action);
				if (!result) {
					set.status = 404;
					return { error: 'Not found' };
				}
				return { ok: true, url: result.url };
			},
			{ params: t.Object({ id: t.String() }), body: t.Object({ action: t.String() }) },
		);
