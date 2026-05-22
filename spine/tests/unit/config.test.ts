import { describe, expect, it, beforeEach, afterEach } from 'bun:test';
import { mkdtempSync, mkdirSync, writeFileSync, rmSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';

// config.ts re-reads on every call, so we can flip env vars between tests freely.
import { getAgentToken, getDatabasePath } from '../../src/config';

describe('config', () => {
	const original = {
		DATABASE_PATH: process.env.DATABASE_PATH,
		LATTICE_AGENT_TOKEN: process.env.LATTICE_AGENT_TOKEN,
		XDG_CONFIG_HOME: process.env.XDG_CONFIG_HOME,
		HOME: process.env.HOME,
	};

	let tmpHome: string;

	beforeEach(() => {
		tmpHome = mkdtempSync(join(tmpdir(), 'spine-config-'));
		process.env.XDG_CONFIG_HOME = tmpHome;
		delete process.env.DATABASE_PATH;
		delete process.env.LATTICE_AGENT_TOKEN;
	});

	afterEach(() => {
		rmSync(tmpHome, { recursive: true, force: true });
		for (const [k, v] of Object.entries(original)) {
			if (v === undefined) delete (process.env as Record<string, string | undefined>)[k];
			else process.env[k] = v;
		}
	});

	describe('getDatabasePath', () => {
		it('returns the default when nothing is set', () => {
			expect(getDatabasePath()).toBe('./lattice.dev.db');
		});

		it('returns the env value when DATABASE_PATH is set', () => {
			process.env.DATABASE_PATH = '/var/lib/lattice/lattice.db';
			expect(getDatabasePath()).toBe('/var/lib/lattice/lattice.db');
		});

		it('reads database_path from TOML config', () => {
			mkdirSync(join(tmpHome, 'lattice'));
			writeFileSync(
				join(tmpHome, 'lattice', 'config.toml'),
				'[spine]\ndatabase_path = "/from/toml/lattice.db"\n',
			);
			expect(getDatabasePath()).toBe('/from/toml/lattice.db');
		});

		it('prefers env over TOML', () => {
			mkdirSync(join(tmpHome, 'lattice'));
			writeFileSync(
				join(tmpHome, 'lattice', 'config.toml'),
				'[spine]\ndatabase_path = "/from/toml/lattice.db"\n',
			);
			process.env.DATABASE_PATH = '/from/env/lattice.db';
			expect(getDatabasePath()).toBe('/from/env/lattice.db');
		});
	});

	describe('getAgentToken', () => {
		it('returns undefined when nothing is set', () => {
			expect(getAgentToken()).toBeUndefined();
		});

		it('returns the env value when LATTICE_AGENT_TOKEN is set', () => {
			process.env.LATTICE_AGENT_TOKEN = 'env-secret';
			expect(getAgentToken()).toBe('env-secret');
		});

		it('reads agent_token from TOML config', () => {
			mkdirSync(join(tmpHome, 'lattice'));
			writeFileSync(
				join(tmpHome, 'lattice', 'config.toml'),
				'[spine]\nagent_token = "toml-secret"\n',
			);
			expect(getAgentToken()).toBe('toml-secret');
		});

		it('prefers env over TOML', () => {
			mkdirSync(join(tmpHome, 'lattice'));
			writeFileSync(
				join(tmpHome, 'lattice', 'config.toml'),
				'[spine]\nagent_token = "toml-secret"\n',
			);
			process.env.LATTICE_AGENT_TOKEN = 'env-secret';
			expect(getAgentToken()).toBe('env-secret');
		});
	});

	describe('malformed config.toml', () => {
		it('does not throw and falls back to defaults', () => {
			mkdirSync(join(tmpHome, 'lattice'));
			writeFileSync(join(tmpHome, 'lattice', 'config.toml'), 'this is not = valid [toml');
			// Should warn and return defaults rather than crash.
			expect(getDatabasePath()).toBe('./lattice.dev.db');
			expect(getAgentToken()).toBeUndefined();
		});
	});

	describe('XDG fallback', () => {
		it('falls back to $HOME/.config when XDG_CONFIG_HOME is unset', () => {
			delete process.env.XDG_CONFIG_HOME;
			process.env.HOME = tmpHome;
			mkdirSync(join(tmpHome, '.config', 'lattice'), { recursive: true });
			writeFileSync(
				join(tmpHome, '.config', 'lattice', 'config.toml'),
				'[spine]\nagent_token = "home-secret"\n',
			);
			expect(getAgentToken()).toBe('home-secret');
		});
	});
});
