import { Elysia } from 'elysia';
import { staticPlugin } from '@elysiajs/static';
import { existsSync } from 'node:fs';
import { join } from 'node:path';
import type { Database } from 'bun:sqlite';
import { authentikBeforeHandle, agentBeforeHandle } from './guards';
import { capturesRoutes } from './routes/captures';
import { searchRoutes } from './routes/search';
import { filesRoutes } from './routes/files';
import { workingRoutes } from './routes/working';
import { lateralRoutes } from './routes/lateral';
import { tracksRoutes } from './routes/tracks';
import { agentRoutes } from './routes/agent';
import { statusRoutes } from './routes/status';
import { settingsRoutes } from './routes/settings';
import { tasksRoutes } from './routes/tasks';
import { attachmentRoutes } from './routes/attachments';
import { archivesRoutes } from './routes/archives';
import { annotationsRoutes } from './routes/annotations';
import { resurfacedRoutes } from './routes/resurfaced';
import { clusterRoutes } from './routes/clusters';
import { buildPlatformStatus } from './status';
import { getActiveAgentToken } from './settings';

export interface AppDeps {
	db: Database;
	allowHttp: boolean;
	devUser: string | undefined;
	surfaceBuild: string | undefined;
	attachmentsDir: string;
	archiveDir: string;
}

export function buildApp(deps: AppDeps) {
	const { db, allowHttp, devUser, surfaceBuild, attachmentsDir, archiveDir } = deps;

	const surface =
		surfaceBuild && existsSync(surfaceBuild)
			? staticPlugin({ assets: surfaceBuild, prefix: '', indexHTML: true, alwaysStatic: false })
			: new Elysia();

	// SPA-shell fallback for the surface's client-side cluster route (018 F9:
	// /cluster/:id is bookmarkable). Targeted rather than a catch-all so unknown
	// paths still 404.
	const spaFallback =
		surfaceBuild && existsSync(join(surfaceBuild, 'index.html'))
			? new Elysia().get('/cluster/:id', () => Bun.file(join(surfaceBuild, 'index.html')))
			: new Elysia();

	return new Elysia()
		.get('/ping', () => ({ ok: true }))
		.get('/favicon.ico', ({ redirect }) => redirect('/favicon.svg', 302))
		.use(surface)
		.use(spaFallback)
		.guard({ beforeHandle: authentikBeforeHandle({ allowHttp, devUser }) }, (app) =>
			app
				.use(capturesRoutes(db))
				.use(tasksRoutes(db, { attachmentsDir }))
				.use(searchRoutes())
				.use(filesRoutes(db))
				.use(workingRoutes(db, { attachmentsDir }))
				.use(lateralRoutes(db))
				.use(tracksRoutes(db, { attachmentsDir }))
				.use(
					statusRoutes(db, () =>
						buildPlatformStatus({
							db,
							agentToken: getActiveAgentToken(),
							allowHttp,
							devUser,
							surfaceBuild,
						}),
					),
				)
				.use(attachmentRoutes(db, { attachmentsDir }))
				.use(annotationsRoutes(db))
				.use(archivesRoutes(db, { archiveDir }))
				.use(resurfacedRoutes(db))
				.use(clusterRoutes(db))
				.use(settingsRoutes(db)),
		)
		.group('/api/agent', (app) =>
			app.guard(
				{ beforeHandle: agentBeforeHandle({ allowHttp, getAgentToken: getActiveAgentToken }) },
				(inner) => inner.use(agentRoutes(db, { attachmentsDir, archiveDir })),
			),
		);
}
