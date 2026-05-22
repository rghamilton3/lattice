import { useQueryClient } from '@tanstack/svelte-query';
import { getWorkbenchContext } from './workbench.svelte';
import { taskKeys, completeTask } from '$lib/api/tasks';
import { logError } from '$lib/utils/logError';
import type { Task } from '$lib/types';

export function useCompleteTask() {
	const wb = getWorkbenchContext();
	const queryClient = useQueryClient();

	return async function (task: Task) {
		queryClient.setQueryData(taskKeys.list(), (old: Task[] | undefined) =>
			old ? old.filter((t) => t.id !== task.id) : []
		);
		wb.showToast('Task done');
		try {
			await completeTask(task.id);
			queryClient.invalidateQueries({ queryKey: taskKeys.done() });
		} catch (err) {
			logError('completeTask', err);
			queryClient.invalidateQueries({ queryKey: taskKeys.list() });
			wb.showToast('Complete failed');
		}
	};
}
