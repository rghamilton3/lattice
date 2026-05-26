import type { Capture, InboxActionDescriptor, InboxItem } from '$lib/types';

export const CAPTURE_INBOX_ACTIONS: InboxActionDescriptor[] = [
	{ action: 'keep', label: 'Keep', shortcut: 'k', tone: 'primary' },
	{ action: 'archive', label: 'Archive', shortcut: 'a', tone: 'neutral' },
	{ action: 'promote', label: 'Promote', shortcut: 'p', tone: 'neutral' },
	{ action: 'task', label: 'Task', shortcut: 't', tone: 'neutral' },
	{ action: 'skip', label: 'Skip', shortcut: 'Space', tone: 'neutral' }
];

export function captureToInboxItem(capture: Capture): InboxItem {
	return {
		item_type: 'capture',
		id: `capture:${capture.id}`,
		capture_id: capture.id,
		title: capture.text,
		summary: capture.text,
		source: capture.source,
		created_at: capture.ingested_at,
		capture,
		actions: CAPTURE_INBOX_ACTIONS
	};
}
