export class ApiError extends Error {
	readonly status: number;
	readonly body: string;
	constructor(status: number, body: string) {
		super(`API ${status}`);
		this.name = 'ApiError';
		this.status = status;
		this.body = body;
	}
}

export async function apiFetch<T>(path: string, init?: RequestInit): Promise<T> {
	const res = await fetch(path, {
		...init,
		headers: { 'Content-Type': 'application/json', ...init?.headers }
	});
	if (!res.ok) {
		throw new ApiError(res.status, await res.text());
	}
	return res.json() as Promise<T>;
}
