import { describe, it, expect } from 'vitest';
import { parseToc } from './parseToc';

describe('parseToc', () => {
	it('returns empty array for empty string', () => {
		expect(parseToc('')).toEqual([]);
	});

	it('returns empty array when no headings present', () => {
		expect(parseToc('Just some prose.\n\nAnother paragraph.')).toEqual([]);
	});

	it('detects a single H1', () => {
		expect(parseToc('# Hello')).toEqual([{ level: 1, text: 'Hello', lineNumber: 1 }]);
	});

	it('detects all heading levels H1 through H6', () => {
		const doc = '# H1\n## H2\n### H3\n#### H4\n##### H5\n###### H6';
		const result = parseToc(doc);
		expect(result).toHaveLength(6);
		expect(result[0]).toEqual({ level: 1, text: 'H1', lineNumber: 1 });
		expect(result[1]).toEqual({ level: 2, text: 'H2', lineNumber: 2 });
		expect(result[2]).toEqual({ level: 3, text: 'H3', lineNumber: 3 });
		expect(result[3]).toEqual({ level: 4, text: 'H4', lineNumber: 4 });
		expect(result[4]).toEqual({ level: 5, text: 'H5', lineNumber: 5 });
		expect(result[5]).toEqual({ level: 6, text: 'H6', lineNumber: 6 });
	});

	it('reports correct 1-based line numbers in mixed document', () => {
		const doc = 'prose\n\n## Section One\n\nmore prose\n\n### Subsection';
		const result = parseToc(doc);
		expect(result).toHaveLength(2);
		expect(result[0].lineNumber).toBe(3);
		expect(result[1].lineNumber).toBe(7);
	});

	it('trims trailing whitespace from heading text', () => {
		const result = parseToc('## Title with spaces   ');
		expect(result[0].text).toBe('Title with spaces');
	});

	it('does not detect Setext-style headings', () => {
		const doc = 'Not a heading\n==============\nAlso not\n---------';
		expect(parseToc(doc)).toEqual([]);
	});

	it('does not match hash with no trailing space', () => {
		expect(parseToc('#NoSpace')).toEqual([]);
	});

	it('does not match lone hash with space but no text', () => {
		expect(parseToc('# ')).toEqual([]);
	});

	it('handles headings inside content that resembles code blocks', () => {
		const doc = '```\n# inside fence\n```\n# Outside fence';
		const result = parseToc(doc);
		// Line-based regex does not skip fenced code blocks by design
		expect(result).toHaveLength(2);
		expect(result[0]).toEqual({ level: 1, text: 'inside fence', lineNumber: 2 });
		expect(result[1]).toEqual({ level: 1, text: 'Outside fence', lineNumber: 4 });
	});
});
