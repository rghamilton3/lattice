import tailwindcss from '@tailwindcss/vite';
import { defineConfig } from 'vitest/config';
import { playwright } from '@vitest/browser-playwright';
import { sveltekit } from '@sveltejs/kit/vite';
import { execSync } from 'child_process';
import { readFileSync } from 'fs';
import { resolve } from 'path';

const pkg = JSON.parse(readFileSync(resolve(import.meta.dirname, 'package.json'), 'utf8')) as {
	version: string;
};

// In a git worktree, node_modules hardlinks resolve to the main checkout's paths.
// Vite's fs-allow check uses realpath, so we need to include the main repo root.
function worktreeMainRoot(): string | null {
	try {
		const gitDir = execSync('git rev-parse --git-common-dir', {
			cwd: resolve(import.meta.dirname),
			encoding: 'utf8',
			stdio: ['ignore', 'pipe', 'ignore']
		}).trim();
		return gitDir.endsWith('/.git') ? gitDir.slice(0, -5) : null;
	} catch {
		return null;
	}
}

const mainRoot = worktreeMainRoot();

export default defineConfig({
	plugins: [tailwindcss(), sveltekit()],

	define: {
		__SURFACE_VERSION__: JSON.stringify(pkg.version)
	},

	server: {
		...(mainRoot ? { fs: { allow: [mainRoot] } } : {}),
		proxy: {
			'/api': {
				target: 'http://localhost:3000',
				changeOrigin: true,
				configure: (proxy) => {
					proxy.on('proxyReq', (proxyReq) => {
						proxyReq.setHeader('x-forwarded-proto', 'https');
						proxyReq.setHeader('x-authentik-username', 'dev');
					});
				}
			}
		}
	},

	test: {
		expect: { requireAssertions: true },
		projects: [
			{
				extends: './vite.config.ts',
				test: {
					name: 'client',
					browser: {
						enabled: true,
						provider: playwright(),
						instances: [{ browser: 'chromium', headless: true }]
					},
					include: ['src/**/*.svelte.{test,spec}.{js,ts}'],
					exclude: ['src/lib/server/**']
				}
			},

			{
				extends: './vite.config.ts',
				test: {
					name: 'server',
					environment: 'node',
					include: ['src/**/*.{test,spec}.{js,ts}'],
					exclude: ['src/**/*.svelte.{test,spec}.{js,ts}']
				}
			}
		]
	}
});
