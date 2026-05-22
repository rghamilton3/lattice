import { describe, expect, it, beforeEach, afterEach } from 'bun:test';
import { readFileSync, existsSync, mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { mkTestEnv, type TestEnv } from '../helpers/env';
import {
	captureToMarkdown,
	localFileToMarkdown,
	writeCaptureFile,
	writeLocalFile,
	capturesDir,
	localFilesDir,
} from '../../src/search';

let env: TestEnv;

beforeEach(() => {
	env = mkTestEnv();
	// search.ts's write helpers expect the directories to exist.
	mkdirSync(capturesDir(), { recursive: true });
	mkdirSync(localFilesDir(), { recursive: true });
});

afterEach(() => {
	env.cleanup();
});

describe('captureToMarkdown', () => {
	it('emits a YAML frontmatter block followed by the body', () => {
		const md = captureToMarkdown({
			id: 7,
			text: 'hello',
			source: 'agent',
			captured_at: '2026-01-01T00:00:00Z',
		});
		expect(md).toBe('---\nid: 7\nsource: agent\ncaptured_at: 2026-01-01T00:00:00Z\n---\n\nhello\n');
	});

	it('sanitizes newlines in frontmatter values to avoid breaking parsers', () => {
		const md = captureToMarkdown({
			id: 1,
			text: 'body',
			source: 'a\nbad\rsource',
			captured_at: 'ts',
		});
		expect(md).toContain('source: a bad source');
		// text is preserved as-is below the frontmatter
		expect(md).toContain('\nbody\n');
	});
});

describe('localFileToMarkdown', () => {
	it('uses machine_id and path in frontmatter', () => {
		const md = localFileToMarkdown('laptop-1', '/etc/hosts', '127.0.0.1 localhost');
		expect(md).toBe('---\nmachine_id: laptop-1\npath: /etc/hosts\n---\n\n127.0.0.1 localhost\n');
	});
});

describe('writeCaptureFile', () => {
	it('writes the markdown to <capturesDir>/<id>.md', () => {
		writeCaptureFile(42, 'body', 'signal', '2026-01-01T00:00:00Z');
		const path = join(capturesDir(), '42.md');
		expect(existsSync(path)).toBe(true);
		const content = readFileSync(path, 'utf-8');
		expect(content).toContain('id: 42');
		expect(content).toContain('source: signal');
		expect(content).toContain('body');
	});
});

describe('writeLocalFile', () => {
	it('writes to <localFilesDir>/<machine>/<hash>.md and creates the machine directory', () => {
		writeLocalFile('m1', '/a', 'abc123', 'body');
		const path = join(localFilesDir(), 'm1', 'abc123.md');
		expect(existsSync(path)).toBe(true);
		expect(readFileSync(path, 'utf-8')).toContain('path: /a');
	});

	it('deletes the previous-hash file when content changes', () => {
		writeLocalFile('m1', '/a', 'old', 'v1');
		const oldPath = join(localFilesDir(), 'm1', 'old.md');
		expect(existsSync(oldPath)).toBe(true);

		writeLocalFile('m1', '/a', 'new', 'v2', 'old');
		expect(existsSync(oldPath)).toBe(false);
		expect(existsSync(join(localFilesDir(), 'm1', 'new.md'))).toBe(true);
	});

	it('does not delete when prevHash equals current hash', () => {
		writeLocalFile('m1', '/a', 'same', 'v1');
		const path = join(localFilesDir(), 'm1', 'same.md');
		writeLocalFile('m1', '/a', 'same', 'v1-modified', 'same');
		expect(existsSync(path)).toBe(true);
		expect(readFileSync(path, 'utf-8')).toContain('v1-modified');
	});

	it('does not delete anything when prevHash is undefined', () => {
		// Pre-existing file at "first" should survive a new write at "second".
		writeLocalFile('m1', '/a', 'first', 'x');
		writeLocalFile('m1', '/a', 'second', 'y');
		expect(existsSync(join(localFilesDir(), 'm1', 'first.md'))).toBe(true);
		expect(existsSync(join(localFilesDir(), 'm1', 'second.md'))).toBe(true);
	});

	it('tolerates a missing previous file (idempotent cleanup)', () => {
		// No file exists at "ghost.md", but we still pass it as prevHash.
		writeLocalFile('m1', '/a', 'new', 'body', 'ghost');
		expect(existsSync(join(localFilesDir(), 'm1', 'new.md'))).toBe(true);
	});
});
