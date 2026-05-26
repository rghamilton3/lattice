import { describe, expect, it } from 'bun:test';
import { parseCommand } from '../../src/commands';

describe('parseCommand', () => {
	describe('known commands', () => {
		it('/task maps to triage_action task', () => {
			expect(parseCommand('/task buy oat milk')).toEqual({
				action: 'task',
				strippedText: 'buy oat milk',
			});
		});

		it('/note maps to triage_action keep', () => {
			expect(parseCommand('/note remember this')).toEqual({
				action: 'keep',
				strippedText: 'remember this',
			});
		});

		it('/skip maps to triage_action skip', () => {
			expect(parseCommand('/skip pick up dry cleaning')).toEqual({
				action: 'skip',
				strippedText: 'pick up dry cleaning',
			});
		});
	});

	describe('case insensitivity', () => {
		it('/TASK is treated as /task', () => {
			expect(parseCommand('/TASK buy milk'))?.toEqual({
				action: 'task',
				strippedText: 'buy milk',
			});
		});

		it('/Note is treated as /note', () => {
			expect(parseCommand('/Note remember this'))?.toEqual({
				action: 'keep',
				strippedText: 'remember this',
			});
		});

		it('/SKIP is treated as /skip', () => {
			expect(parseCommand('/SKIP transient'))?.toEqual({
				action: 'skip',
				strippedText: 'transient',
			});
		});
	});

	describe('plain text — returns null', () => {
		it('no leading slash', () => {
			expect(parseCommand('buy oat milk')).toBeNull();
		});

		it('slash in the middle', () => {
			expect(parseCommand('hello /task later')).toBeNull();
		});

		it('unknown command with body', () => {
			expect(parseCommand('/foobar some text')).toBeNull();
		});

		it('known command with no body (/task alone)', () => {
			expect(parseCommand('/task')).toBeNull();
		});

		it('known command with only whitespace body', () => {
			expect(parseCommand('/task   ')).toBeNull();
		});

		it('just a slash', () => {
			expect(parseCommand('/')).toBeNull();
		});

		it('empty string', () => {
			expect(parseCommand('')).toBeNull();
		});

		it('Object prototype key (/constructor) is not treated as a command', () => {
			expect(parseCommand('/constructor foo')).toBeNull();
		});

		it('Object prototype key (/toString) is not treated as a command', () => {
			expect(parseCommand('/toString something')).toBeNull();
		});
	});

	describe('text stripping', () => {
		it('strips leading whitespace before the command', () => {
			expect(parseCommand('   /task buy milk'))?.toEqual({
				action: 'task',
				strippedText: 'buy milk',
			});
		});

		it('trims body whitespace', () => {
			expect(parseCommand('/task   buy milk   '))?.toEqual({
				action: 'task',
				strippedText: 'buy milk',
			});
		});

		it('handles multiple spaces between command and body', () => {
			expect(parseCommand('/task   buy   milk'))?.toEqual({
				action: 'task',
				strippedText: 'buy   milk',
			});
		});

		it('handles tabs between command and body', () => {
			expect(parseCommand('/task\tbuy milk'))?.toEqual({
				action: 'task',
				strippedText: 'buy milk',
			});
		});

		it('preserves slashes in body text', () => {
			expect(parseCommand('/note see /etc/hosts'))?.toEqual({
				action: 'keep',
				strippedText: 'see /etc/hosts',
			});
		});
	});
});
