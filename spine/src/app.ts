import { Elysia } from 'elysia';
import { staticPlugin } from '@elysiajs/static';
import { existsSync } from 'node:fs';
import type { Database } from 'bun:sqlite';
import { authentikBeforeHandle, agentBeforeHandle } from './guards';
import { capturesRoutes } from './routes/captures';
import { searchRoutes } from './routes/search';
import { filesRoutes } from './routes/files';
import { workingRoutes, type WorkingRoutesOptions } from './routes/working';
import { lateralRoutes } from './routes/lateral';
import { agentRoutes } from './routes/agent';
import { statusRoutes } from './routes/status';
import { tasksRoutes } from './routes/tasks';
import { attachmentRoutes } from './routes/attachments';

export interface AppDeps {
	db: Database;
	agentToken: string | undefined;
	allowHttp: boolean;
	devUser: string | undefined;
	surfaceBuild: string | undefined;
	attachmentsDir: string;
}

export function buildApp(deps: AppDeps) {
	const { db, agentToken, allowHttp, devUser, surfaceBuild, attachmentsDir } = deps;

	const surface =
		surfaceBuild && existsSync(surfaceBuild)
			? staticPlugin({ assets: surfaceBuild, prefix: '', indexHTML: true, alwaysStatic: false })
			: new Elysia();

	return new Elysia()
		.get('/ping', () => ({ ok: true }))
		.get('/favicon.ico', ({ redirect }) => redirect('/favicon.svg', 302))
		.use(surface)
		.guard({ beforeHandle: authentikBeforeHandle({ allowHttp, devUser }) }, (app) =>
			app
				.use(capturesRoutes(db))
				.use(tasksRoutes(db))
				.use(searchRoutes())
				.use(filesRoutes(db))
				.use(workingRoutes(db, { attachmentsDir }))
				.use(lateralRoutes(db))
				.use(statusRoutes(db))
				.use(attachmentRoutes(db, { attachmentsDir })),
		)
		.group('/api/agent', (app) =>
			app.guard({ beforeHandle: agentBeforeHandle({ allowHttp, agentToken }) }, (inner) =>
				inner.use(agentRoutes(db, { attachmentsDir })),
			),
		);
}
