import { describe, expect, it, beforeEach, afterEach } from 'bun:test';
import { mkdtempSync, writeFileSync, rmSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import {
	extractInline,
	extractSubprocess,
	isInlineType,
	isImageType,
	isSubprocessType,
	ocrImage,
} from '../src/extract';

let tmpDir: string;

beforeEach(() => {
	tmpDir = mkdtempSync(join(tmpdir(), 'extract-test-'));
});

afterEach(() => {
	rmSync(tmpDir, { recursive: true, force: true });
});

describe('extractInline', () => {
	it('returns exact content of a plain-text file', () => {
		const path = join(tmpDir, 'hello.txt');
		writeFileSync(path, 'hello world');
		expect(extractInline(path)).toBe('hello world');
	});

	it('truncates content longer than 100k chars at a word boundary', () => {
		const word = 'abcde ';
		let content = word.repeat(Math.ceil(100_020 / word.length));
		const path = join(tmpDir, 'big.txt');
		writeFileSync(path, content);
		const result = extractInline(path);
		expect(result.length).toBeLessThanOrEqual(100_000);
		// Should end on a word boundary (space or start of word), never mid-word
		const afterResult = content.slice(result.length);
		expect(afterResult.startsWith(' ') || afterResult.startsWith('a')).toBe(true);
	});
});

describe('isInlineType', () => {
	it('returns true for text/plain', () => expect(isInlineType('text/plain')).toBe(true));
	it('returns true for text/markdown', () => expect(isInlineType('text/markdown')).toBe(true));
	it('returns true for text/csv', () => expect(isInlineType('text/csv')).toBe(true));
	it('strips charset parameters', () =>
		expect(isInlineType('text/plain; charset=utf-8')).toBe(true));
	it('returns false for application/pdf', () =>
		expect(isInlineType('application/pdf')).toBe(false));
	it('returns false for image/jpeg', () => expect(isInlineType('image/jpeg')).toBe(false));
});

describe('isImageType', () => {
	it('returns true for image/jpeg', () => expect(isImageType('image/jpeg')).toBe(true));
	it('returns true for image/png', () => expect(isImageType('image/png')).toBe(true));
	it('returns true for image/webp', () => expect(isImageType('image/webp')).toBe(true));
	it('returns false for text/plain', () => expect(isImageType('text/plain')).toBe(false));
	it('returns false for application/pdf', () => expect(isImageType('application/pdf')).toBe(false));
});

describe('isSubprocessType', () => {
	it('returns true for application/pdf', () =>
		expect(isSubprocessType('application/pdf')).toBe(true));
	it('returns true for DOCX MIME type', () =>
		expect(
			isSubprocessType('application/vnd.openxmlformats-officedocument.wordprocessingml.document'),
		).toBe(true));
	it('returns false for text/plain', () => expect(isSubprocessType('text/plain')).toBe(false));
	it('returns false for image/jpeg', () => expect(isSubprocessType('image/jpeg')).toBe(false));
});

describe('ocrImage', () => {
	it('returns empty string when ocr_model is not configured (no config in test env)', async () => {
		const path = join(tmpDir, 'img.png');
		writeFileSync(path, 'fake image bytes');
		// No config.toml in test env → getOcrModel() returns undefined → returns ''
		const result = await ocrImage(path, 'image/png');
		expect(result).toBe('');
	});
});

describe('extractSubprocess', () => {
	it('throws when the subprocess binary is not found or returns non-zero', async () => {
		// A garbage file passed to pdftotext: either the binary is absent (ENOENT throw)
		// or it exits non-zero on invalid input — both paths exercise the error branch.
		const path = join(tmpDir, 'garbage.pdf');
		writeFileSync(path, 'this is not a real pdf');
		await expect(extractSubprocess(path, 'application/pdf')).rejects.toThrow();
	});
});
