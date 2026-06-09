/**
 * Helpers for deciding when the editor should adopt server content.
 *
 * The working-doc editor autosaves and then refetches the document. Without a
 * precise rule, that refetch can clobber in-progress edits and reset the cursor
 * (in vim, back to line 1) whenever a save round-trip races ahead of typing.
 *
 * `baseline` is the last content known to be in sync with the server (the
 * initially loaded content, or the content of the most recent successful save).
 * We only overwrite the editor when it holds exactly that baseline — i.e. the
 * user has no un-synced local edits — so we never destroy unsaved text or move
 * the caret out from under them.
 */
export function shouldAdoptServerContent(
	current: string,
	server: string,
	baseline: string
): boolean {
	return server !== current && current === baseline;
}

/** Clamp a document position into the valid [0, len] range. */
export function clampPos(pos: number, len: number): number {
	if (pos < 0) return 0;
	if (pos > len) return len;
	return pos;
}
