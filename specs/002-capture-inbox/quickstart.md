# Quickstart: Capture Inbox

## Run Locally

1. Install dependencies if needed with `just install`.
2. Start spine and surface with `just dev`.
3. Open the surface in the browser.
4. Open quick capture, enter text, and save.
5. Confirm the capture appears at the top of the inbox.

## Validate Server Behavior

Run spine capture route tests:

```bash
cd spine && bun test tests/routes/captures.test.ts
```

Expected coverage includes recent capture ordering, empty inbox response, cursor validation, create capture success, empty capture rejection, over-limit rejection, and SSE event emission.

## Validate Surface Behavior

Run surface type and component checks:

```bash
cd surface && bun run check
```

Manual checks:

- Quick capture opens with focus in the text field.
- `Ctrl+Enter` or `Cmd+Enter` saves a valid capture.
- Empty and over-10,000-character drafts cannot be saved and communicate why.
- Save failure leaves the draft available.
- Inbox loading, error, empty, and populated states use visible text.
- New captures from another open window appear without a full page reload when the event stream is connected.

## Accessibility Evidence

Record verification in `docs/accessibility/capture-inbox.md` before marking implementation complete.
