import { mkdtempSync, rmSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { initDb, __resetDbForTests } from '../db';

export function createTestDb() {
	const dir = mkdtempSync(join(tmpdir(), 'spine-test-'));
	const previousPath = process.env.DATABASE_PATH;
	process.env.DATABASE_PATH = join(dir, 'lattice.db');
	__resetDbForTests();
	const db = initDb();

	return {
		db,
		dir,
		cleanup() {
			db.close();
			__resetDbForTests();
			if (previousPath === undefined) delete process.env.DATABASE_PATH;
			else process.env.DATABASE_PATH = previousPath;
			rmSync(dir, { recursive: true, force: true });
		},
	};
}
