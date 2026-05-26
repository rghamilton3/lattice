import { afterEach, beforeEach, describe, expect, it } from 'bun:test';
import { existsSync } from 'node:fs';
import { join } from 'node:path';
import { mkTestEnv, type TestEnv } from '../helpers/env';
import { initDb } from '../../src/db';
import { classifyArchive } from '../../src/archiveQuality';
import {
	archiveAttentionMessage,
	emitArchiveAttention,
	onArchiveAttention,
	shouldSendArchiveAttention,
} from '../../src/archiveEvents';
import {
	ArchiveValidationError,
	applyArchiveAction,
	createArchive,
	normalizeArchiveUrl,
	readArchiveArtifact,
} from '../../src/archives';

let env: TestEnv;
let db: ReturnType<typeof initDb>;

beforeEach(() => {
	env = mkTestEnv();
	db = initDb();
});

afterEach(() => {
	db.close();
	env.cleanup();
});

describe('classifyArchive', () => {
	it('marks empty output as failed', () => {
		expect(classifyArchive('', '').quality).toBe('failed');
	});

	it('marks JavaScript-required shells as degraded', () => {
		const result = classifyArchive(
			'<div id="root"></div><p>Please enable JavaScript</p>',
			'Please enable JavaScript',
		);
		expect(result.quality).toBe('degraded');
	});

	it('marks mostly empty app shells as degraded', () => {
		const result = classifyArchive('<div id="root"></div>', 'Loading');
		expect(result.quality).toBe('degraded');
		expect(result.reason).toBe('mostly empty app shell');
	});

	it('marks substantial readable captures as good', () => {
		const text = Array.from({ length: 45 }, (_, i) => `word${i}`).join(' ');
		expect(classifyArchive(`<main>${text}</main>`, text).quality).toBe('good');
	});
});

describe('archive helpers', () => {
	it('normalizes http URLs and strips fragments', () => {
		expect(normalizeArchiveUrl(' https://example.com/docs#section ')).toBe(
			'https://example.com/docs',
		);
	});

	it('rejects non-http URLs as validation errors', () => {
		expect(() => normalizeArchiveUrl('file:///tmp/x')).toThrow(ArchiveValidationError);
	});
});

describe('archive attention events', () => {
	const input = {
		type: 'archive_recapture' as const,
		title: 'Broken capture',
		url: 'https://example.com/a',
		archive_id: 123,
		quality: 'degraded' as const,
	};

	it('respects notification posture', () => {
		expect(shouldSendArchiveAttention('quiet', input)).toBe(false);
		expect(shouldSendArchiveAttention('standard', input)).toBe(true);
		expect(shouldSendArchiveAttention('active', input)).toBe(true);
		expect(shouldSendArchiveAttention('standard', { ...input, type: 'archive_recent' })).toBe(
			false,
		);
		expect(shouldSendArchiveAttention('active', { ...input, type: 'archive_recent' })).toBe(true);
	});

	it('emits subscribed attention messages', () => {
		const seen: string[] = [];
		const off = onArchiveAttention((_input, message) => seen.push(message));
		try {
			emitArchiveAttention('standard', input);
		} finally {
			off();
		}

		expect(seen).toEqual([archiveAttentionMessage(input)]);
	});
});

describe('createArchive', () => {
	it('stores an HTML artifact and extracted text', () => {
		const row = createArchive(db, {
			url: 'https://example.com/a',
			title: 'Example',
			html: '<html><title>Ignored</title><body><p>Hello &amp; goodbye</p></body></html>',
			capturedVia: 'singlefile',
			source: 'test',
			whySaved: 'later',
			quality: 'good',
			archiveDir: env.archiveDir,
		});

		expect(row.id).toBeGreaterThan(0);
		expect(row.title).toBe('Example');
		expect(row.extracted_text).toContain('Hello & goodbye');
		expect(existsSync(row.archive_path)).toBe(true);
		expect(readArchiveArtifact(row, env.archiveDir)).toContain('<html>');
	});

	it('supersedes unresolved degraded archives for the same URL when a good archive arrives', () => {
		const degraded = createArchive(db, {
			url: 'https://example.com/a#fragment',
			html: '<html><body>enable javascript</body></html>',
			capturedVia: 'monolith',
			quality: 'degraded',
			archiveDir: env.archiveDir,
		});
		const good = createArchive(db, {
			url: 'https://example.com/a',
			html: '<html><body>good archive content with enough words to be treated as stored</body></html>',
			capturedVia: 'singlefile',
			quality: 'good',
			archiveDir: env.archiveDir,
		});

		expect(good.superseded).toEqual([degraded.id]);
		const old = db.query('SELECT superseded_by FROM archives WHERE id = ?').get(degraded.id) as {
			superseded_by: number;
		};
		expect(old.superseded_by).toBe(good.id);
	});

	it('keeps artifact reads confined to the configured archive dir', () => {
		const row = createArchive(db, {
			url: 'https://example.com/a',
			html: '<html><body>safe</body></html>',
			capturedVia: 'singlefile',
			quality: 'good',
			archiveDir: env.archiveDir,
		});
		const escaped = { ...row, archive_path: join(env.dir, 'outside.html') };
		expect(() => readArchiveArtifact(escaped, env.archiveDir)).toThrow(ArchiveValidationError);
	});

	it('applies keep/delete/recapture actions', () => {
		const row = createArchive(db, {
			url: 'https://example.com/a',
			html: '<html><body>safe</body></html>',
			capturedVia: 'singlefile',
			quality: 'good',
			archiveDir: env.archiveDir,
		});

		expect(applyArchiveAction(db, row.id, 'recapture')).toEqual({ url: 'https://example.com/a' });
		expect(applyArchiveAction(db, row.id, 'keep')).toEqual({ url: 'https://example.com/a' });
		const kept = db.query('SELECT review_action FROM archives WHERE id = ?').get(row.id) as {
			review_action: string;
		};
		expect(kept.review_action).toBe('keep');
		expect(applyArchiveAction(db, row.id, 'delete')).toEqual({ url: 'https://example.com/a' });
		const deleted = db.query('SELECT deleted_at FROM archives WHERE id = ?').get(row.id) as {
			deleted_at: string | null;
		};
		expect(deleted.deleted_at).not.toBeNull();
	});
});
