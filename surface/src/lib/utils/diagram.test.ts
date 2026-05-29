import { describe, expect, it } from 'vitest';
import { mermaidTemplate } from './diagram';

describe('mermaidTemplate', () => {
	it('inserts a fenced Mermaid flowchart block', () => {
		expect(mermaidTemplate).toContain('```mermaid');
		expect(mermaidTemplate).toContain('flowchart TD');
		expect(mermaidTemplate.endsWith('\n')).toBe(true);
	});
});
