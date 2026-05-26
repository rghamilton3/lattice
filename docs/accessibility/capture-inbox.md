# Accessibility Evidence: Capture Inbox

**Feature**: Capture Inbox
**Date**: 2026-05-26

## Scope

- Quick capture dialog and save/error states.
- Recent inbox loading, empty, error, and populated states.
- Live update recovery messaging.

## WCAG 2.2 AA Checks

- [x] Quick capture can be opened, used, submitted with Ctrl/Cmd+Enter, and dismissed with keyboard input.
- [x] Dialog focus starts in the capture text field and remains inside the modal while open.
- [x] Buttons have visible labels or accessible names.
- [x] Empty, loading, save failure, live-disconnect, and over-limit states are communicated with text, not color alone.
- [x] Capture rows are reachable and activatable by keyboard with Enter or Space.
- [x] Text remains readable at supported viewport sizes.

## Notes

- Bilingual content is not required for this feature.
- Quick capture exposes the draft status with `aria-describedby`; over-limit drafts set `aria-invalid` and disable Save until shortened to 10,000 characters or fewer.
- Inbox loading and live-disconnect messages use visible status text; load errors use alert text.
- Existing attachment behavior remains available and keeps text feedback when saving fails.
