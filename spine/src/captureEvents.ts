// Process-local in-memory pub/sub. NOTE: not cross-process — horizontal
// scaling requires replacing this with a shared bus (Redis, etc.).
import type { CaptureRow } from './db/rows';

type Listener = (capture: CaptureRow) => void;

const listeners = new Set<Listener>();

export function onCapture(fn: Listener): () => void {
	listeners.add(fn);
	return () => listeners.delete(fn);
}

export function emitCapture(capture: CaptureRow): void {
	for (const fn of listeners) {
		try {
			fn(capture);
		} catch (e) {
			console.error('[captureEvents] listener threw:', e);
		}
	}
}

export function __listenerCount(): number {
	return listeners.size;
}
export function __resetListeners(): void {
	listeners.clear();
}
