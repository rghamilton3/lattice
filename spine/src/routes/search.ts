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
			// One adaptive path: full-quality via the remote endpoint, degrading to BM25
			// keyword-only when it is unavailable. Returned verbatim ({ results, degraded });
			// `degraded` drives the surface badge.
			return search(q);
		},
		{ query: t.Object({ q: t.Optional(t.String()) }) },
	);
