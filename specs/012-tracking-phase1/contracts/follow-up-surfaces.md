# Contract: Follow-Up Surfaces

Phase 1 may use a minimal Surface view, Signal messages, or documented browser/curl flows. Any chosen surface must satisfy this user-facing contract.

Chosen Phase 1 surface: documented browser/curl endpoint flow. No persistent Surface UI is added for this milestone, so persistent web UI accessibility evidence is N/A until a durable tracking view is introduced.

## Retrieval Surface

### Required User Actions

- Enter a plain-language tracking query.
- See the primary newest useful answer with text, time, source/provenance, and displaced state.
- See older matching records as history.
- Open a result so the system can record `opened_track_id`.

### Required States

- Blank query: clear user-facing failure.
- No useful match: clear empty state or closest simple matches.
- Displaced result: visible state with text or icon/label, not color alone.
- Search failure: readable plain-language error.

### Accessibility Requirements For Persistent Web UI

- Query input has a meaningful label.
- Search, result rows, and open actions are keyboard reachable.
- Focus is visible on inputs, buttons, and result rows.
- Primary result and history distinction does not rely on color alone.
- Empty and error states are announced as text in the page, not only via visual styling.

## Follow-Up Surface

### Prompt Content

For non-displaced opened tracks:

```text
You looked up "drill" 2 days ago.
Last tracked as: drill is on the garage top shelf, blue case

[Still there] [No - here's where it is now] [Skip]
```

For displaced opened tracks:

```text
You looked up "drill" 2 days ago.
Last tracked as: drill working on the deck for the weekend
(checked out)

[Still out] [No - here's where it is now] [Skip]
```

### Required User Actions

- Confirm still accurate.
- Record where the item is now with non-blank text.
- Skip.

### Required Behavior

- The prompt references the original query and opened track.
- The affirmative label adapts to displaced state.
- Exactly three outcomes are presented.
- Skip and expiration do not create counters, badges, debt text, or repeat nags.
- Ignoring the follow-up does not block tracking or retrieval.

### Accessibility Requirements For Persistent Web UI

- Follow-up prompt is reachable by keyboard.
- All three actions are buttons with meaningful accessible names.
- The moved/new-location input has a visible label and clear validation message.
- Displaced state is communicated in text, not color alone.
- Focus moves predictably when opening or submitting the moved/new-location flow.

## Duplicate-Hint Surface

### Prompt Content

```text
Saved. This may relate to an earlier track:
drill in blue case on garage shelf - tracked 6 days ago via signal-text
```

### Required Behavior

- The saved state is clear before or alongside the hint.
- Hints are advisory and may be ignored.
- No merge, edit, delete, or supersede action happens automatically.
- Absence of hints does not interrupt tracking.

### Accessibility Requirements For Persistent Web UI

- Hint text is readable and does not rely on color.
- Any optional action has a visible label and keyboard access.
- The saved confirmation is not conveyed by color alone.

## Signal Or CLI Surface Requirements

- Output is plain text and readable without color.
- Actions use explicit words or reply syntax, not icon-only controls.
- Error messages name the problem and the next possible action.
- Messages avoid debt language such as overdue counts, streaks, or backlog pressure.
