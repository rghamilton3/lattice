import { Elysia, t } from 'elysia';
import { search, searchDeep } from '../search';

export const searchRoutes = () =>
	new Elysia().get(
		'/api/search',
		async ({ query, set }) => {
			const q = query.q?.trim() ?? '';
			if (!q) {
				set.status = 400;
				return { error: 'q is required' };
			}
			const results = await (query.deep === 'true' ? searchDeep(q) : search(q));
			return { results };
		},
		{ query: t.Object({ q: t.Optional(t.String()), deep: t.Optional(t.String()) }) },
	);
