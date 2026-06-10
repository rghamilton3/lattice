import type { Database } from 'bun:sqlite';
import { runResurfacePass } from './cluster';

let _timer: ReturnType<typeof setTimeout> | ReturnType<typeof setInterval> | null = null;

export function startResurfaceTimer(db: Database): void {
	if (_timer) return;

	const IS_DEV = process.env.NODE_ENV !== 'production';
	// Dev: run immediately; prod: delay 60–120 min to spread restarts
	const initialDelay = IS_DEV ? 0 : (60 + Math.random() * 60) * 60_000;
	const intervalMs = (22 + Math.random() * 4) * 60 * 60_000; // 22–26 h

	const safeRun = () => {
		try {
			runResurfacePass(db);
		} catch (err) {
			console.error('[resurface] background pass failed:', err);
		}
	};

	const scheduleInterval = () => {
		const t = setInterval(safeRun, intervalMs);
		if (typeof t === 'object' && t !== null && 'unref' in t) (t as NodeJS.Timeout).unref();
		_timer = t;
	};

	if (initialDelay === 0) {
		safeRun();
		scheduleInterval();
	} else {
		const t = setTimeout(() => {
			safeRun();
			scheduleInterval();
		}, initialDelay);
		if (typeof t === 'object' && t !== null && 'unref' in t) (t as NodeJS.Timeout).unref();
		_timer = t;
	}
}

export function stopResurfaceTimer(): void {
	if (_timer) {
		clearTimeout(_timer as ReturnType<typeof setTimeout>);
		clearInterval(_timer as ReturnType<typeof setInterval>);
		_timer = null;
	}
}

export function __runResurfaceForTests(db: Database): void {
	runResurfacePass(db);
}
