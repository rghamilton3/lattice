export type TriageAction = 'keep' | 'archive' | 'promote' | 'task' | 'skip';

const COMMAND_MAP = new Map<string, TriageAction>([
	['task', 'task'],
	['todo', 'task'],
	['note', 'keep'],
	['skip', 'skip'],
]);

export interface ParsedCommand {
	action: TriageAction;
	strippedText: string;
}

/**
 * Returns a parsed command if `text` starts with a known `/command <body>` prefix,
 * or null if the text is plain (including unknown commands or commands with no body).
 * Case-insensitive. The stripped text never includes the slash-command prefix.
 */
export function parseCommand(text: string): ParsedCommand | null {
	const trimmed = text.trimStart();
	if (!trimmed.startsWith('/')) return null;

	const match = trimmed.match(/^\/(\S+)\s+([\s\S]*\S)\s*$/);
	if (!match) return null; // e.g. "/task" alone — treat as plain text

	const command = match[1].toLowerCase();
	const action = COMMAND_MAP.get(command);
	if (!action) return null; // unknown command — plain text

	const strippedText = match[2].trim();

	return { action, strippedText };
}
