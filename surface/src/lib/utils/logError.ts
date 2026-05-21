// Single seam for error logging so production telemetry can replace it later.
export function logError(scope: string, err: unknown): void {
	console.error(`[${scope}]`, err);
}
