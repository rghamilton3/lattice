import { describe, expect, it, vi } from 'vitest';
import { render } from 'vitest-browser-svelte';
import MarkdownRenderer from './MarkdownRenderer.svelte';

describe('MarkdownRenderer', () => {
	it('renders Mermaid flowchart node labels after sanitization', async () => {
		const screen = await render(MarkdownRenderer, {
			content:
				'```mermaid\n---\ntitle: Visible title\n---\nflowchart TD\n  A[Start] --> B[Next]\n```'
		});

		await vi.waitFor(() => {
			const svgText = Array.from(screen.container.querySelectorAll('svg text, svg tspan'))
				.map((el) => el.textContent ?? '')
				.join('\n');

			expect(svgText).toContain('Visible title');
			expect(svgText).toContain('Start');
			expect(svgText).toContain('Next');
		});
	});
});
