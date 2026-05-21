import { getContext, setContext } from 'svelte';
import type { PaneContent } from '$lib/types';

const WORKBENCH_KEY = Symbol('workbench');

export class WorkbenchStore {
	panes = $state<[PaneContent] | [PaneContent, PaneContent]>([{ kind: 'search', query: '' }]);
	focusedPane = $state<0 | 1>(0);
	vimMode = $state(true);

	isSplit = $derived(this.panes.length === 2);

	openInPane(index: 0 | 1, content: PaneContent) {
		if (index === 0) {
			this.panes = this.isSplit
				? ([content, this.panes[1]] as [PaneContent, PaneContent])
				: ([content] as [PaneContent]);
		} else {
			this.panes = [this.panes[0], content];
		}
		this.focusedPane = index;
	}

	openInOther(currentPane: 0 | 1, content: PaneContent) {
		this.openInPane(currentPane === 0 ? 1 : 0, content);
	}

	closeRightPane() {
		this.panes = [this.panes[0]];
		if (this.focusedPane === 1) this.focusedPane = 0;
	}

	toggleVim() {
		this.vimMode = !this.vimMode;
	}
}

export function setWorkbenchContext(store: WorkbenchStore) {
	setContext(WORKBENCH_KEY, store);
}

export function getWorkbenchContext(): WorkbenchStore {
	return getContext<WorkbenchStore>(WORKBENCH_KEY);
}
