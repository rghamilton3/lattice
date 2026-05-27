import { join } from 'node:path';
import type { Database } from 'bun:sqlite';
import { buildApp } from '../app';

export const TEST_AGENT_TOKEN = 'test-agent-token';

export function buildTestApp(db: Database, attachmentsDir: string) {
	return buildApp({
		db,
		agentToken: TEST_AGENT_TOKEN,
		allowHttp: true,
		devUser: undefined,
		surfaceBuild: undefined,
		attachmentsDir: join(attachmentsDir, 'attachments'),
		archiveDir: join(attachmentsDir, 'archive'),
	});
}

export function agentJson(path: string, body: unknown, token = TEST_AGENT_TOKEN): Request {
	return new Request(`http://spine.test${path}`, {
		method: 'POST',
		headers: { 'content-type': 'application/json', authorization: `Bearer ${token}` },
		body: JSON.stringify(body),
	});
}

export function browserGet(path: string, username = 'test-user'): Request {
	return new Request(`http://spine.test${path}`, {
		headers: { 'x-authentik-username': username },
	});
}

export function browserJson(path: string, body: unknown, username = 'test-user'): Request {
	return new Request(`http://spine.test${path}`, {
		method: 'POST',
		headers: { 'content-type': 'application/json', 'x-authentik-username': username },
		body: JSON.stringify(body),
	});
}
