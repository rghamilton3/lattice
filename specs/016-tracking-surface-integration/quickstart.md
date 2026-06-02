# Quickstart: Tracking Surface Integration

## Setup

1. Install dependencies if needed from the existing project setup.
2. Start the full app with `just dev`.
3. If testing Spine only, run `cd spine && ALLOW_HTTP=true DEV_USER=dev bun run dev`.
4. If testing Surface only against a running Spine, run `cd surface && bun run dev`.

## Seed Or Create Test Tracks

1. Create several tracks for the same item through the existing agent route or new Surface form.
2. Include at least one older location, one newest location, one displaced record, and one record with `photo_ref` or a browser-uploaded photo.
3. Open a search result so a follow-up can become eligible through existing `track_queries` behavior.

## Validate Search And Reading

1. Open the Surface tracking workspace.
2. Search for a tracked item.
3. Confirm the top result appears before older history.
4. Confirm time, source, displaced state, and photo availability are visible.
5. Open a result and confirm the stable reading view shows the selected record, same-item history, and related location records.
6. Reload or navigate back to the stable tracking detail link and confirm it restores the record view.

## Validate Surface Track Creation

1. Submit a blank tracking form and confirm no record is created and a clear message appears.
2. Submit a text-only record and confirm it appears in search and board results.
3. Upload a photo, submit a record with the returned photo reference, and confirm thumbnail/preview behavior.
4. Simulate or force a save failure and confirm entered text remains available for retry.

## Validate Board Flow

1. Open the board view.
2. Create a new free-text bin.
3. Confirm unbinned or matching item cards are visible.
4. Move a card into the bin with pointer drag if implemented.
5. Move a card into a bin with keyboard-accessible controls.
6. Confirm each move creates a new current tracking record, clears displaced state, and preserves older history.
7. Mark an item checked out with context and confirm the displaced indicator and displaced-only filter work without relying on color alone.
8. Confirm similar item phrases remain separate and no drag gesture merges them.

## Validate Follow-Ups

1. Prepare a pending follow-up from an opened query.
2. Confirm the follow-up appears in the tracking workspace or `Where you were` context.
3. For a non-displaced record, confirm the affirmative action says `Still there`.
4. For a displaced record, confirm the affirmative action says `Still out`.
5. Choose still-accurate and confirm the prompt disappears without a new track.
6. Choose moved, enter a new location, and confirm a new `surface-followup` record supersedes the opened record.
7. Choose skip and confirm the prompt does not reappear as backlog.

## Accessibility And Responsive Checks

1. Complete search, record open, text entry, photo upload, bin creation, card move, displaced filter, checkout, and follow-up resolution with keyboard only.
2. Confirm visible focus on all interactive controls.
3. Confirm all icon or color states have text or accessible names.
4. Resize to a narrow viewport and confirm primary controls do not require page-level horizontal scrolling.
5. Update `docs/accessibility/tracking-surface.md` with results and any residual risks.

## Automated Checks

Run focused checks during implementation:

```bash
cd spine && bun test src/routes/tracks.test.ts src/routes/agent.track.test.ts src/tracks.schema.test.ts
cd surface && bun run check
cd surface && bun run test:unit -- --run
```

Before merge, run when feasible:

```bash
just test
just check
just lint
cd surface && bun run test:e2e
```
