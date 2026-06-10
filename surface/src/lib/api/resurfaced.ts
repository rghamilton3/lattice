import type { ResurfacedItem } from '$lib/types';

export const resurfacedKeys = {
	today: () => ['resurfaced', 'today'] as const
};

export async function fetchResurfaced(): Promise<{ items: ResurfacedItem[] }> {
	const res = await fetch('/api/resurfaced');
	if (!res.ok) throw new Error('Failed to fetch resurfaced items');
	return res.json();
}

export async function dismissResurfaced(id: number): Promise<{ ok: boolean }> {
	const res = await fetch(`/api/resurfaced/${id}/dismiss`, { method: 'POST' });
	if (!res.ok) throw new Error('Failed to dismiss item');
	return res.json();
}
