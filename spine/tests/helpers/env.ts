import { mkdtempSync, rmSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';

export interface TestEnv {
	dir: string;
	dbPath: string;
	attachmentsDir: string;
	archiveDir: string;
	cleanup(): void;
}

// Allocate a fresh tmp directory, point DATABASE_PATH at it, and return paths
// the tests need. Call cleanup() in afterAll to remove the directory.
export function mkTestEnv(): TestEnv {
	const dir = mkdtempSync(join(tmpdir(), 'spine-test-'));
	const dbPath = join(dir, 'lattice.db');
	const attachmentsDir = join(dir, 'attachments');
	const archiveDir = join(dir, 'web');

	process.env.DATABASE_PATH = dbPath;

	return {
		dir,
		dbPath,
		attachmentsDir,
		archiveDir,
		cleanup() {
			delete process.env.DATABASE_PATH;
			try {
				rmSync(dir, { recursive: true, force: true });
			} catch {
				// best-effort cleanup
			}
		},
	};
}
