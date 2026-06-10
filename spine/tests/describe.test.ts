import { describe, expect, it, beforeEach, afterEach } from 'bun:test';
import { mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { generateDescription } from '../src/describe';
import { buildTestApp, type TestApp } from './helpers/app';

let app: TestApp;
let tmpImagePath: string;
let originalXdg: string | undefined;
let originalFetch: typeof globalThis.fetch;

beforeEach(async () => {
	app = await buildTestApp();

	// Point XDG_CONFIG_HOME at a temp dir containing a minimal config with
	// embed_api_url + vlm_model so generateDescription doesn't return early.
	const configDir = join(app.env.dir, 'xdg', 'lattice');
	mkdirSync(configDir, { recursive: true });
	writeFileSync(
		join(configDir, 'config.toml'),
		'[spine.qmd]\nembed_api_url = "http://localhost:9999"\nvlm_model = "test-vlm"\n',
	);
	originalXdg = process.env.XDG_CONFIG_HOME;
	process.env.XDG_CONFIG_HOME = join(app.env.dir, 'xdg');

	// Write a tiny fake image so readFileSync in generateDescription doesn't throw.
	tmpImagePath = join(app.env.dir, 'test.png');
	writeFileSync(tmpImagePath, Buffer.from([0x89, 0x50, 0x4e, 0x47]));

	originalFetch = globalThis.fetch;
});

afterEach(async () => {
	globalThis.fetch = originalFetch;
	if (originalXdg !== undefined) {
		process.env.XDG_CONFIG_HOME = originalXdg;
	} else {
		delete process.env.XDG_CONFIG_HOME;
	}
	await app?.cleanup();
});

function makeFetch(text: string): typeof globalThis.fetch {
	return async () =>
		new Response(JSON.stringify({ choices: [{ message: { content: text } }] }), {
			status: 200,
			headers: { 'Content-Type': 'application/json' },
		}) as Response;
}

function insertDarkAttachment(captureId: number): number {
	const row = app.db
		.prepare(
			`INSERT INTO capture_attachments
			 (capture_id, signal_id, content_type, filename, size_bytes, stored_path, created_at, extraction_status)
			 VALUES (?, '', 'image/png', 'test.png', 4, '', '2026-01-01T00:00:00Z', 'dark')
			 RETURNING id`,
		)
		.get(captureId) as { id: number };
	return row.id;
}

function insertCapture(): number {
	const row = app.db
		.prepare(
			`INSERT INTO captures (text, source, captured_at, ingested_at)
			 VALUES ('hello', 'test', '2026-01-01T00:00:00Z', '2026-01-01T00:00:00Z')
			 RETURNING id`,
		)
		.get() as { id: number };
	return row.id;
}

describe('generateDescription supersedes chain', () => {
	it('creates first description with supersedes = NULL', async () => {
		globalThis.fetch = makeFetch('First description.');
		const captureId = insertCapture();
		const attId = insertDarkAttachment(captureId);

		await generateDescription(attId, 'capture', tmpImagePath, app.db);

		const rows = app.db
			.query(
				`SELECT * FROM attachment_descriptions WHERE attachment_kind = 'capture' AND attachment_id = ?`,
			)
			.all(attId) as Array<{ id: number; final_text: string; supersedes: number | null }>;
		expect(rows).toHaveLength(1);
		expect(rows[0].supersedes).toBeNull();
		expect(rows[0].final_text).toBe('First description.');
	});

	it('supersedes old row and marks new row as current on re-generation', async () => {
		const captureId = insertCapture();
		const attId = insertDarkAttachment(captureId);

		globalThis.fetch = makeFetch('First description.');
		await generateDescription(attId, 'capture', tmpImagePath, app.db);

		globalThis.fetch = makeFetch('Second description.');
		await generateDescription(attId, 'capture', tmpImagePath, app.db);

		const all = app.db
			.query(
				`SELECT id, final_text, supersedes FROM attachment_descriptions
				 WHERE attachment_kind = 'capture' AND attachment_id = ?
				 ORDER BY id`,
			)
			.all(attId) as Array<{ id: number; final_text: string; supersedes: number | null }>;
		expect(all).toHaveLength(2);

		const first = all.find((r) => r.final_text === 'First description.');
		const second = all.find((r) => r.final_text === 'Second description.');
		expect(first).toBeDefined();
		expect(second).toBeDefined();

		// New row is the current one: supersedes IS NULL
		expect(second!.supersedes).toBeNull();
		// Old row points forward to the new row
		expect(first!.supersedes).toBe(second!.id);
	});

	it('WHERE supersedes IS NULL returns the most recent description after re-generation', async () => {
		const captureId = insertCapture();
		const attId = insertDarkAttachment(captureId);

		globalThis.fetch = makeFetch('Old text.');
		await generateDescription(attId, 'capture', tmpImagePath, app.db);

		globalThis.fetch = makeFetch('New text.');
		await generateDescription(attId, 'capture', tmpImagePath, app.db);

		const current = app.db
			.query(
				`SELECT final_text FROM attachment_descriptions
				 WHERE attachment_kind = 'capture' AND attachment_id = ? AND supersedes IS NULL`,
			)
			.get(attId) as { final_text: string } | null;
		expect(current?.final_text).toBe('New text.');
	});

	it('does not re-generate when existing description is confirmed', async () => {
		const captureId = insertCapture();
		const attId = insertDarkAttachment(captureId);

		globalThis.fetch = makeFetch('Confirmed text.');
		await generateDescription(attId, 'capture', tmpImagePath, app.db);

		// Mark it confirmed
		app.db
			.prepare(
				`UPDATE attachment_descriptions SET confirmed = 1
				 WHERE attachment_kind = 'capture' AND attachment_id = ?`,
			)
			.run(attId);

		let fetchCalled = false;
		globalThis.fetch = async () => {
			fetchCalled = true;
			return makeFetch('Should not be called.')();
		};
		await generateDescription(attId, 'capture', tmpImagePath, app.db);

		expect(fetchCalled).toBe(false);
		const count = (
			app.db
				.query(
					`SELECT COUNT(*) as n FROM attachment_descriptions
				 WHERE attachment_kind = 'capture' AND attachment_id = ?`,
				)
				.get(attId) as { n: number }
		).n;
		expect(count).toBe(1);
	});
});
