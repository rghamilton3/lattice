import type { CaptureRow } from "./db/rows";

type Listener = (capture: CaptureRow) => void;

const listeners = new Set<Listener>();

export function onCapture(fn: Listener): () => void {
  listeners.add(fn);
  return () => listeners.delete(fn);
}

export function emitCapture(capture: CaptureRow): void {
  for (const fn of listeners) fn(capture);
}
