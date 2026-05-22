import { apiFetch } from './client';
import type { Task, TaskPriority } from '$lib/types';

export const taskKeys = {
	list: () => ['tasks', 'list'] as const,
	done: () => ['tasks', 'done'] as const
};

export function fetchTasks(): Promise<Task[]> {
	return apiFetch('/api/tasks');
}

export function fetchCompletedTasks(): Promise<Task[]> {
	return apiFetch('/api/tasks/done');
}

export interface CreateTaskParams {
	text: string;
	due_date?: string;
	priority?: TaskPriority;
	notes?: string;
}

export function createTask(params: CreateTaskParams): Promise<{ id: number }> {
	return apiFetch('/api/tasks', { method: 'POST', body: JSON.stringify(params) });
}

export interface UpdateTaskMetaParams {
	due_date?: string | null;
	priority?: TaskPriority | null;
	notes?: string | null;
}

export function updateTaskMeta(id: number, params: UpdateTaskMetaParams): Promise<void> {
	return apiFetch(`/api/captures/${id}/task`, { method: 'PATCH', body: JSON.stringify(params) });
}

export function completeTask(id: number): Promise<void> {
	return apiFetch(`/api/tasks/${id}/complete`, { method: 'PATCH' });
}

export function uncompleteTask(id: number): Promise<void> {
	return apiFetch(`/api/tasks/${id}/uncomplete`, { method: 'PATCH' });
}
