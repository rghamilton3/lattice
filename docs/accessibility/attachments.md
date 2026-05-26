# Attachments Accessibility Evidence

## Scope

Feature: Attachments (`specs/005-attachments`)

User-facing artifacts reviewed:
- Reading pane attach control and hidden file picker trigger.
- Standalone file upload dialog.
- Attachment rail list, minimize/expand, resize, open, and delete controls.
- PDF preview loading and error states.

## WCAG 2.2 AA Checks

### Keyboard Operation

- Reading pane upload starts from a native button and does not require pointer-only interaction.
- Upload dialog controls are native buttons, textarea, and file input trigger controls; existing dialog tab trap keeps keyboard focus inside the modal.
- Attachment links and delete controls are keyboard reachable.
- Attachment rail resize separator is focusable and supports ArrowLeft/ArrowRight adjustments.
- Minimize and expand controls are native buttons with accessible labels.

### Names, Roles, and Labels

- Reading pane attach button includes an explicit `aria-label` describing the current parent kind.
- Upload dialog includes an `aria-label` for the optional note and for removing the selected file.
- Attachment rail is exposed as a labelled complementary region with labelled resize separator and file list.
- Attachment delete buttons include the target filename in their accessible names.
- PDF canvases receive page-specific image labels after rendering.

### Status and Error Messaging

- Reading pane upload progress is announced through a polite status region.
- Upload dialog readiness, failure, and selected-file states are exposed through a polite status region.
- Attachment deletion status is exposed through a polite status region.
- Attachment rail load failures use an alert role.
- PDF preview loading uses a polite status region; preview errors use an alert role.

### Color and Focus

- Error states use text in addition to color, such as `Upload failed - try again` and `Failed to load attachments.`
- Attachment rail resize focus has a visible outline and background change.
- Native buttons and links retain the existing application focus treatment.

## Bilingual Delivery

N/A. The current Lattice product surface and existing feature specifications are English-only. This feature introduces no bilingual content requirement.

## Residual Risks

- PDF canvas rendering cannot provide full document text to assistive technology without OCR/text-layer work, which is out of scope for this phase.
- Browser-native file picker accessibility depends on the user's browser and operating system.
