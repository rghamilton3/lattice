import { existsSync } from 'node:fs';
import type { Database } from 'bun:sqlite';
import { getMigrationStatus } from './db';

export type PlatformState = 'ready' | 'starting' | 'unhealthy';

export interface PlatformCheck {
	ok: boolean;
	message: string;
}

export interface StorageCheck extends PlatformCheck {
	applied_migrations: number;
}

export interface PlatformStatusOptions {
	db: Database;
	agentToken: string | undefined;
	allowHttp: boolean;
	devUser: string | undefined;
	surfaceBuild: string | undefined;
}

export interface PlatformStatus {
	ready: boolean;
	state: PlatformState;
	checks: {
		configuration: PlatformCheck;
		storage: StorageCheck;
		access_boundary: PlatformCheck;
		static_assets: PlatformCheck;
	};
}

export function buildPlatformStatus({
	db,
	agentToken,
	allowHttp,
	devUser,
	surfaceBuild,
}: PlatformStatusOptions): PlatformStatus {
	const migrations = getMigrationStatus(db);
	const configurationOk = Boolean(agentToken);
	const accessBoundaryOk = configurationOk && (!allowHttp || Boolean(devUser));
	const checks = {
		configuration: {
			ok: configurationOk,
			message: configurationOk
				? 'Configuration is valid'
				: 'Agent token is not configured; agent routes will reject requests',
		},
		storage: {
			ok: migrations.ready,
			message: migrations.ready ? 'Storage is initialized' : 'Storage is not initialized',
			applied_migrations: migrations.applied,
		},
		access_boundary: {
			ok: accessBoundaryOk,
			message: accessBoundaryOk
				? accessBoundaryMessage({ allowHttp, devUser })
				: accessBoundaryFailureMessage({ agentToken, allowHttp, devUser }),
		},
		static_assets: staticAssetsCheck(surfaceBuild),
	};
	const ready = Object.values(checks).every((check) => check.ok);
	const state = ready ? 'ready' : platformState({ checks, migrations });

	return {
		ready,
		state,
		checks,
	};
}

function platformState({
	checks,
	migrations,
}: Pick<PlatformStatus, 'checks'> & {
	migrations: ReturnType<typeof getMigrationStatus>;
}): PlatformState {
	if (
		!migrations.ready &&
		checks.configuration.ok &&
		checks.access_boundary.ok &&
		checks.static_assets.ok
	) {
		return 'starting';
	}
	return 'unhealthy';
}

function accessBoundaryMessage({
	allowHttp,
	devUser,
}: Pick<PlatformStatusOptions, 'allowHttp' | 'devUser'>) {
	if (allowHttp || devUser) return 'Protected access can be enforced with development overrides';
	return 'Protected access can be enforced';
}

function accessBoundaryFailureMessage({
	agentToken,
	allowHttp,
	devUser,
}: Pick<PlatformStatusOptions, 'agentToken' | 'allowHttp' | 'devUser'>) {
	if (!agentToken) return 'Protected access cannot be fully enforced without an agent token';
	if (allowHttp && !devUser)
		return 'Protected access cannot be fully enforced while HTTP is allowed';
	return 'Protected access cannot be fully enforced';
}

function staticAssetsCheck(surfaceBuild: string | undefined): PlatformCheck {
	if (!surfaceBuild) return { ok: true, message: 'Static assets are not configured' };
	if (existsSync(surfaceBuild)) return { ok: true, message: 'Static assets are available' };
	return { ok: false, message: 'Configured static asset path is unavailable' };
}
