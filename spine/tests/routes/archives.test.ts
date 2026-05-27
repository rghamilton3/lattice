import { afterEach, beforeEach, describe, expect, it } from 'bun:test';
import { buildTestApp, json, req, type TestApp } from '../helpers/app';
import { createArchive } from '../../src/archives';

let app: TestApp;

beforeEach(async () => {
	app = await buildTestApp({ agentToken: 'test-token' });
});

afterEach(async () => {
	await app?.cleanup();
});

function agentPost(path: string, body: unknown) {
	return req(path, {
		method: 'POST',
		headers: {
			'content-type': 'application/json',
			authorization: 'Bearer test-token',
		},
		body: JSON.stringify(body),
	});
}

function archivePageRequest(form: FormData) {
	return req('/api/agent/archive-page', {
		method: 'POST',
		headers: { authorization: 'Bearer test-token' },
		body: form,
	});
}

describe('archive routes', () => {
	it('stores SingleFile uploads via the agent route', async () => {
		const form = new FormData();
		form.set('url', 'https://example.com/page#frag');
		form.set('title', 'Example Page');
		form.set('why_saved', 'Need this later');
		form.set(
			'file',
			new Blob(['<html><body>saved page body</body></html>'], { type: 'text/html' }),
			'page.html',
		);

		const res = await app.app.handle(archivePageRequest(form));
		expect(res.status).toBe(200);
		const body = await json(res);
		expect(body).toMatchObject({
			url: 'https://example.com/page',
			title: 'Example Page',
			quality: 'good',
			captured_via: 'singlefile',
			superseded: [],
		});
		const row = app.db
			.query('SELECT source, why_saved FROM archives WHERE id = ?')
			.get(body.id) as {
			source: string;
			why_saved: string;
		};
		expect(row).toEqual({ source: 'browser-ext', why_saved: 'Need this later' });
	});

	it('rejects invalid archive URLs on URL jobs', async () => {
		const res = await app.app.handle(agentPost('/api/agent/archive-url', { url: 'file:///tmp/x' }));
		expect(res.status).toBe(422);
	});

	it('reports archive upload storage failures as server errors', async () => {
		const broken = await buildTestApp({
			agentToken: 'test-token',
			archiveDir: '/proc/lattice-archive-test',
		});
		try {
			const form = new FormData();
			form.set('url', 'https://example.com/page');
			form.set('file', new Blob(['<html><body>saved page body</body></html>']), 'page.html');

			const res = await broken.app.handle(archivePageRequest(form));
			expect(res.status).toBe(500);
			expect(await json(res)).toEqual({ error: 'archive failed' });
		} finally {
			await broken.cleanup();
		}
	});

	it('serves raw archives with sandbox headers', async () => {
		const row = createArchive(app.db, {
			url: 'https://example.com/page',
			html: '<html><script>window.pwned=true</script><body>archive</body></html>',
			capturedVia: 'singlefile',
			quality: 'good',
			archiveDir: app.env.archiveDir,
		});

		const res = await app.app.handle(req(`/api/archives/${row.id}/raw`));
		expect(res.status).toBe(200);
		expect(res.headers.get('content-type')).toBe('text/html; charset=utf-8');
		expect(res.headers.get('content-security-policy')).toContain('sandbox');
		expect(res.headers.get('x-content-type-options')).toBe('nosniff');
		expect(await res.text()).toContain('<script>');
	});

	it('applies archive actions', async () => {
		const row = createArchive(app.db, {
			url: 'https://example.com/page',
			html: '<html><body>archive</body></html>',
			capturedVia: 'singlefile',
			quality: 'good',
			archiveDir: app.env.archiveDir,
		});

		const res = await app.app.handle(
			req(`/api/archives/${row.id}/action`, {
				method: 'POST',
				headers: { 'content-type': 'application/json' },
				body: JSON.stringify({ action: 'keep' }),
			}),
		);
		expect(res.status).toBe(200);
		expect(await json(res)).toEqual({ ok: true, url: 'https://example.com/page' });
		const stored = app.db.query('SELECT review_action FROM archives WHERE id = ?').get(row.id) as {
			review_action: string;
		};
		expect(stored.review_action).toBe('keep');
	});

	it('includes archive review items in the unified inbox', async () => {
		const row = createArchive(app.db, {
			url: 'https://example.com/page',
			title: 'Bad capture',
			html: '<html><body>Please enable JavaScript</body></html>',
			capturedVia: 'monolith',
			source: 'mobile-share',
			quality: 'degraded',
			archiveDir: app.env.archiveDir,
		});

		const res = await app.app.handle(req('/api/inbox'));
		expect(res.status).toBe(200);
		const body = await json(res);
		expect(body.items).toContainEqual(
			expect.objectContaining({
				item_type: 'archive_recapture',
				id: `archive:${row.id}`,
				archive_id: row.id,
				url: 'https://example.com/page',
				quality: 'degraded',
			}),
		);
		const item = body.items.find((i: any) => i.id === `archive:${row.id}`);
		expect(item.actions.map((a: any) => a.action)).toEqual(['recapture', 'delete', 'skip']);
	});
});
