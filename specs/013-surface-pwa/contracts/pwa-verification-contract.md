# Contract: Surface PWA Verification

This contract defines required verification evidence before implementation is considered complete.

## Automated Checks

- Surface static/type check passes with `bun run check` from `surface/`.
- Relevant unit tests pass with `bun run test:unit -- --run` from `surface/`.
- E2E smoke coverage is added where practical for app shell rendering, degraded/offline messaging, and update/reload affordance behavior.
- Repository-level `just check` passes when the implementation is complete.

## Manual PWA Checks

- Open Surface in a supported installable browser over the target HTTPS/self-hosted route.
- Confirm the browser recognizes Surface as installable.
- Install Surface and launch it from the operating system app entry.
- Confirm installed launch reaches the workbench shell within the success criterion target.
- Confirm normal browser-tab use still works when installation is unsupported, unavailable, or dismissed.
- Confirm at least one valid deep link opens the same destination from browser and installed-app context.

## Degraded/Offline Checks

- Load Surface once successfully.
- Simulate unavailable live services or network interruption.
- Relaunch or reload the installed app.
- Confirm the shell renders readable degraded messaging and a recovery action.
- Confirm protected knowledge content is not newly exposed from offline cache.
- Restore services and confirm retry or reload recovers without reinstalling or clearing caches.

## Update Checks

- Install or load one app build.
- Replace it with a newer build in the normal deployment path.
- Reopen or refresh Surface.
- Confirm the app reaches the current version through normal user action.
- Confirm update messaging does not interrupt active text input or modal interaction.

## Accessibility Checks

- Keyboard reaches install, retry, reload, dismiss, and update controls.
- Visible focus remains clear in install/update/degraded states.
- Status messaging is text-based and non-color-only.
- Core states remain readable at 200% zoom and narrow/mobile width.
- Reduced-motion preference does not hide meaning.
- Icon and launch color choices are documented for contrast/recognizability.
- `docs/accessibility/surface-pwa.md` records WCAG 2.2 AA evidence and bilingual N/A rationale.

## CLI Accessibility Checks

No user-facing CLI output changes are planned. If implementation changes commands or terminal output, verify plain text labels, no color-only meaning, and readable failure/recovery wording.
