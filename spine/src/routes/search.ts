import { Elysia, t } from 'elysia';
import { search } from '../search';

export const searchRoutes = () =>
	new Elysia().get(
		'/api/search',
		async ({ query, set }) => {
			const q = query.q?.trim() ?? '';
			if (!q) {
				set.status = 400;
				return { error: 'q is required' };
			}
			// One adaptive path: full-quality via the remote endpoint, degrading to
			// BM25 keyword-only when it is unavailable. `degraded` drives the surface badge.
			const { results, degraded } = await search(q);
			return { results, degraded };
		},
		{ query: t.Object({ q: t.Optional(t.String()) }) },
	);
