import { dirname, join, resolve } from 'node:path';
import { initDb } from './db';
import { initSearch } from './search';
import { getAgentToken, getDatabasePath } from './config';
import { buildApp } from './app';

const DB_PATH = resolve(getDatabasePath());
const ATTACHMENTS_DIR = join(dirname(DB_PATH), 'attachments');
const SURFACE_BUILD = process.env.SURFACE_BUILD ?? join(import.meta.dir, '../../surface/build');

const db = initDb();
await initSearch(db);

const agentToken = getAgentToken();
if (!agentToken) {
	console.warn('WARNING: LATTICE_AGENT_TOKEN not set — all agent routes will reject');
}
if (process.env.DEV_USER) {
	console.warn(
		`WARNING: DEV_USER="${process.env.DEV_USER}" set — Authentik auth is BYPASSED. Never set this in production.`,
	);
}

const app = buildApp({
	db,
	agentToken,
	allowHttp: process.env.ALLOW_HTTP === 'true',
	devUser: process.env.DEV_USER,
	surfaceBuild: SURFACE_BUILD,
	attachmentsDir: ATTACHMENTS_DIR,
}).listen({ port: 3000, hostname: process.env.HOST ?? '127.0.0.1' });

console.log(`Spine listening on http://${app.server?.hostname}:${app.server?.port}`);
