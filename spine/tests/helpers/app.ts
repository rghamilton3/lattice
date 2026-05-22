import { mkTestEnv, type TestEnv } from './env';
import { installQmdMock, type FakeStoreHandle } from './qmd-mock';

export interface TestApp {
	env: TestEnv;
	qmd: FakeStoreHandle;
	app: any;
	db: any;
	cleanup(): Promise<void>;
}

export interface BuildTestAppOptions {
	agentToken?: string | undefined;
	allowHttp?: boolean;
	devUser?: string | undefined;
}

// Sets up a complete test environment:
//   - tmp DATABASE_PATH with migrations applied
//   - QMD mocked (no embedding work)
//   - buildApp() wired with caller-supplied auth knobs
//
// Defaults to allowHttp=true and devUser="dev@local" so most tests don't need to
// think about the HTTPS/Authentik guards. Override per-test as needed.
export async function buildTestApp(opts: BuildTestAppOptions = {}): Promise<TestApp> {
	const env = mkTestEnv();
	const qmd = installQmdMock();

	// Import lazily — the modules must read DATABASE_PATH after env is set.
	const { initDb } = await import('../../src/db');
	const { initSearch, __resetSearchForTests } = await import('../../src/search');
	const { buildApp } = await import('../../src/app');

	__resetSearchForTests();

	const db = initDb();
	await initSearch(db);

	const app = buildApp({
		db,
		agentToken: 'agentToken' in opts ? opts.agentToken : 'test-token',
		allowHttp: opts.allowHttp ?? true,
		devUser: 'devUser' in opts ? opts.devUser : 'dev@local',
		surfaceBuild: undefined,
		attachmentsDir: env.attachmentsDir,
	});

	return {
		env,
		qmd,
		app,
		db,
		async cleanup() {
			try {
				db.close();
			} catch {
				// already closed
			}
			env.cleanup();
		},
	};
}

// Convenience builder for plain Requests.
export function req(
	path: string,
	init?: RequestInit & { headers?: Record<string, string> },
): Request {
	return new Request(`http://localhost${path}`, init);
}

export async function json(res: Response): Promise<any> {
	return await res.json();
}
