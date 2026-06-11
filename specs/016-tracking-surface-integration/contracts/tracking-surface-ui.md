# Contract: Tracking Surface UI

## Workbench Entry And Navigation

- Surface exposes a tracking workspace reachable from the existing workbench/navigation model.
- Stable tracking detail links hydrate into a tracking record reading view for a specific record ID.
- Browser back and in-app back behavior must return to the previous usable Surface state when available.
- Narrow viewports keep search, form, board, and follow-up controls reachable without page-level horizontal scrolling.

## Search View

### Required Controls

- Labeled search input for natural-language item/location queries.
- Search submit button reachable by keyboard.
- Top result area that appears before older matching history.
- History list with record text, time, source/location tag, displaced state, and photo thumbnail when `photo_ref` is present.
- Empty state that invites a new tracking entry instead of leaving a dead end.

### Required Actions

- Submit search.
- Open a result into the tracking reading view.
- Record the open action through `POST /api/tracks/queries/:id/open` when the result came from a logged query.

### Accessibility Requirements

- Input has a visible label or persistent accessible label.
- Loading, empty, and error states are visible text and announced appropriately.
- Top result/history distinction does not rely on color alone.
- Photo thumbnail absence or failure does not hide text content.

## Tracking Reading View

### Required Content

- Selected record text, time, source, displaced state, photo preview if available, and linkable record identity.
- Same-item history.
- Related location records.

### Required Actions

- Return to prior Surface state.
- Start a moved-location follow-up flow when launched from a follow-up prompt.

## Surface Tracking Form

### Required Controls

- Free-form text input.
- Optional photo upload control.
- Submit button.
- Clear validation message for empty text.

### Required Behavior

- Text-only submission creates a `surface-form` track.
- Photo submission first obtains a photo ref, then creates a track with that ref.
- Save failure leaves the user's typed text available for retry.
- Successful save invalidates or refreshes search/board/follow-up data as appropriate.

## Board View

### Required Content

- Free-text bins.
- `Unbinned` area for unclear items.
- One current card per derived item phrase.
- Displaced indicator that uses text/icon plus accessible name, not color alone.
- Displaced-only filter.

### Required Actions

- Create a bin manually.
- Promote a visible location phrase into a bin.
- Move a card into a bin with pointer drag where practical.
- Move a card into a bin with keyboard-accessible controls.
- Mark a card checked out/displaced with free-form context.
- Open card history.

### Required Behavior

- Moving a card creates a new append-only tracking record and clears displaced state.
- Failed moves do not falsely show the destination as authoritative.
- Similar phrases remain separate unless a future explicit merge action is implemented.
- No drag gesture performs merge.

## Follow-Up Area

### Required Content

- Pending follow-up action rows surfaced in the tracking workspace and eligible `Where you were` context.
- Prompt quotes the original query and opened record.
- Affirmative button uses API wording: `Still there` for normal records, `Still out` for displaced records.
- Moved action opens a short new-location input.
- Skip action is available without debt/backlog language.

### Required Behavior

- Still-accurate closes the follow-up with no new record.
- Moved creates a new append-only record with `source: "surface-followup"` and closes the follow-up.
- Skip closes the follow-up with no reschedule.
- Closed prompts disappear and do not reappear as backlog.

## Copy And Language

- Copy is concise plain English.
- Avoid terms like overdue, debt, backlog, streak, or failure for unanswered follow-ups.
- Bilingual delivery is out of scope for this milestone.

## Evidence Requirements

- Update `docs/accessibility/tracking-surface.md` with keyboard, focus, screen-reader-name, contrast, status, non-color-only state, drag-alternative, and reflow evidence.
- Include at least one representative keyboard-only board move validation.
- Include photo upload validation for label, error, and missing-thumbnail fallback.
