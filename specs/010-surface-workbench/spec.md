# Feature Specification: Surface Workbench

**Feature Branch**: `feature/time-machine-surface-workbench`

**Created**: 2026-05-26

**Status**: Draft

**Input**: User description: "Feature: Surface Workbench. Description: Provides the SvelteKit SPA shell for search, reading panes, home posture, command palette, deep links, themes, and focused knowledge work. Relevant files: surface/src/routes/, surface/src/lib/state/workbench.svelte.ts, surface/src/lib/types.ts, surface/src/lib/api/client.ts, surface/src/components/shell/, surface/src/components/workbench/, surface/src/components/reading/ReadingPane.svelte, surface/src/components/reading/MarkdownRenderer.svelte, surface/src/components/home/, surface/src/components/overlays/CommandPalette.svelte, surface/src/components/overlays/Settings.svelte, surface/src/lib/styles/, surface/vite.config.ts, surface/svelte.config.js, surface/e2e/surface.e2e.ts. Focus on this feature only; do not modify other features."

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Work From A Stable Shell (Priority: P1)

As a Lattice user, I want the browser workbench to open quickly into a coherent home surface with persistent preferences, clear navigation, and reliable deep links so I can resume knowledge work without rebuilding context.

**Why this priority**: The workbench shell is the entry point for every other Surface activity. If navigation, persistence, or initial routing is unreliable, search, reading, capture triage, and editing all become harder to trust.

**Independent Test**: Can be fully tested by loading the app, changing theme/density/posture/focus settings, navigating between home/library/tasks/doc states, reloading, and verifying the workbench restores safe defaults or valid persisted preferences without blocking the user.

**Acceptance Scenarios**:

1. **Given** the user opens Surface with no saved session, **When** the page loads, **Then** the home pane appears with shell navigation, status text, capture access, command palette access, and no unrecoverable errors.
2. **Given** the user changes theme, density, posture, focus mode, or Vim mode, **When** the page reloads, **Then** valid preferences persist and invalid or corrupted persisted values are ignored safely.
3. **Given** the user follows a link with a valid document reference, **When** Surface loads, **Then** the referenced document opens in the primary pane; invalid references show a plain failure message and fall back to a usable view.
4. **Given** the user is on a narrow viewport, **When** they use the core navigation and overlays, **Then** controls remain reachable without horizontal page-level scrolling or hidden primary actions.

---

### User Story 2 - Search, Read, And Compare Knowledge (Priority: P2)

As a user doing focused knowledge work, I want search results, reading panes, split panes, lateral actions, and rendered document content to stay readable and predictable so I can move from a memory fragment to supporting context quickly.

**Why this priority**: The value of the workbench depends on retrieval and reading. Users need to inspect captures, indexed files, working docs, attachments, similar items, mentions, and nearby context without losing their place.

**Independent Test**: Can be tested by opening the library, searching or opening seeded results, opening documents in one and two panes, using Similar/Mentions/Nearby/Split actions, and verifying each state is readable, keyboard-accessible, and error-tolerant.

**Acceptance Scenarios**:

1. **Given** search or library data is available, **When** the user opens a result, **Then** the correct reader opens for capture, local file, PDF, or working document content.
2. **Given** a document is open, **When** the user chooses Split or a lateral action, **Then** the related view opens in the other pane without replacing the current reading context.
3. **Given** markdown includes rich content such as code, math, or diagrams, **When** it renders, **Then** the output is sanitized, readable, and failures degrade to visible text rather than breaking the reader.
4. **Given** API calls are loading or fail, **When** the user views a pane, **Then** the pane shows plain loading and error states that identify the failed action and preserve navigation.

---

### User Story 3 - Operate With Keyboard And Low-Friction Controls (Priority: P3)

As a keyboard-oriented user, I want command palette, quick capture, settings, new document, focus mode, and triage shortcuts to be discoverable and non-conflicting so I can work quickly without accidental data loss or inaccessible overlays.

**Why this priority**: Keyboard control and low-friction overlays make the workbench usable for ADHD-aware workflows, but they must not interfere with text entry, screen readers, or modal interactions.

**Independent Test**: Can be tested by using documented shortcuts from the home screen and from inputs/editors, navigating overlays with keyboard, closing them with Escape, and confirming focus and status feedback remain clear.

**Acceptance Scenarios**:

1. **Given** no text field or modal owns focus, **When** the user presses command shortcuts such as capture, command palette, search, focus mode, or new doc, **Then** the intended action opens and announces usable labels or status text.
2. **Given** a text input, editor, or triage mode has focus, **When** the user types shortcut-like keys, **Then** the workbench does not unexpectedly steal those keys from the active task.
3. **Given** an overlay is open, **When** the user uses Tab, Enter, Arrow keys, or Escape, **Then** focus remains inside the active interaction where appropriate and the close/confirm behavior is clear.
4. **Given** a user prefers reduced motion, **When** overlays, panes, or settings appear, **Then** motion is minimized while preserving understandable visual transitions.

---

### Edge Cases

- Corrupted, partial, or quota-limited browser storage prevents preference persistence.
- Deep-link parameters are missing, malformed, stale, or refer to content that no longer exists.
- Surface loads while spine is unavailable, slow, returns unexpected JSON, or returns an authorization failure.
- Search, status, captures, tasks, working docs, attachments, or reading content fail independently while other panes remain usable.
- Markdown rendering encounters invalid Mermaid, malformed math, unsafe HTML, very large content, or repeated content changes before prior rendering completes.
- Split-pane actions are invoked when the same content is already open or when the right pane was just closed.
- Keyboard shortcuts are pressed inside text inputs, CodeMirror editors, file inputs, or modal flows that own the keyboard.
- Command palette results are empty, stale, very long, or include multiple items with similar labels.
- Settings values are changed rapidly or set to system theme while OS theme changes.
- Status bar has no active agents, stale agent reports, or missing timestamps.
- Narrow viewports, zoomed text, high contrast modes, and reduced-motion preferences are active.
- Browser APIs such as localStorage, EventSource, dynamic imports, or clipboard/selection APIs are unavailable.

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: Surface MUST provide a single-page workbench shell with primary navigation for home, library/search, and tasks, plus access to capture, settings, command palette, and focus mode.
- **FR-002**: Surface MUST maintain one or two independent panes, track the focused pane, open new content in the intended pane, and allow the secondary pane to close without losing the primary pane.
- **FR-003**: Surface MUST route pane content by typed document/view references including home, library, search results, captures, indexed local files, working documents, editors, and tasks.
- **FR-004**: Surface MUST support deep links for valid document/view references and show a non-blocking plain error message for invalid references.
- **FR-005**: Surface MUST persist user-facing workbench preferences for theme, density, reading font, posture, focus mode, and Vim mode, while ignoring corrupted or invalid persisted values.
- **FR-006**: Surface MUST fetch server status and show active agent count and latest sync information in text form, with a safe fallback when status data is unavailable.
- **FR-007**: Surface MUST provide a command palette that exposes core actions and recent/openable knowledge items, supports keyboard navigation, and handles empty results without trapping the user.
- **FR-008**: Surface MUST provide a settings surface for theme, density, reading font, notification posture, and editor mode with visible labels and persisted selections.
- **FR-009**: Surface MUST provide keyboard shortcuts for common workbench actions while avoiding shortcut handling inside text-entry targets, editors, and modal flows that own the keyboard.
- **FR-010**: Surface MUST render captures, indexed files, PDFs, and working documents with clear loading, error, and empty states.
- **FR-011**: Surface MUST sanitize rendered markdown and degrade gracefully when math, diagram, or rich rendering fails.
- **FR-012**: Surface MUST expose lateral reading actions for similar items, selected-text mentions, nearby-in-time context, split view, promotion to working documents, editing, and attachments where applicable.
- **FR-013**: Surface MUST preserve live home workflows for inbox review, task preview, working docs, and posture-dependent counts or resurfacing hints.
- **FR-014**: Surface MUST use only documented spine `/api/*` endpoints and MUST NOT require direct database access, hosted services, or new infrastructure for core workbench behavior.
- **FR-015**: Surface MUST provide automated coverage for core shell routing, preferences, command palette, settings, reading/deep-link behavior, and no-regression accessibility checks where feasible.

### Accessibility Requirements

- **A11Y-001**: Interactive controls, pane regions, overlays, settings groups, and reading actions MUST have accessible names or visible text labels; icon-only controls require text alternatives.
- **A11Y-002**: Loading, error, upload, capture, and sync feedback MUST be communicated in text and must not rely on color, icon shape, or animation alone.
- **A11Y-003**: Keyboard access MUST cover shell navigation, overlays, command palette, settings, split panes, and close/cancel/confirm actions without trapping focus permanently.
- **A11Y-004**: Surface MUST respect reduced-motion preferences and retain readable contrast across light, dark, sepia, and system themes.
- **A11Y-005**: Accessibility evidence for workbench UI changes MUST be documented under `docs/accessibility/`.

### Localization Requirements

- **LANG-001**: Bilingual delivery is not required for this feature because Surface currently ships English-only local product copy and no translated UI resources; this N/A decision MUST be recorded in accessibility evidence.

### Key Entities

- **Workbench Session**: User-facing preferences and active shell state, including theme, density, font, posture, focus mode, Vim mode, panes, and focused pane.
- **Pane**: A work area that displays one typed content reference and can be primary or secondary.
- **Pane Content**: A discriminated view/document target such as home, library, results, capture, local file, working document, editor, or tasks.
- **Document Reference**: A stable reference to a capture, indexed local file, or working document that can be opened from links, search, palette, or lateral actions.
- **Overlay**: A temporary interaction layer such as command palette, quick capture, settings, new document, new task, file upload, or triage mode.
- **Workbench Preference**: A persisted, user-controlled display or interaction setting.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: A user can load the workbench from a clean browser session and reach home, library, tasks, capture, settings, and command palette without a console-blocking error.
- **SC-002**: Valid preference changes persist after reload, and a deliberately corrupted saved session falls back to defaults without preventing the home view from rendering.
- **SC-003**: A valid document deep link opens the referenced content in the primary pane, while an invalid deep link shows a visible failure message and keeps the user in a usable view.
- **SC-004**: Opening a document and using Split plus at least one lateral action preserves the original pane and opens supporting context in the other pane.
- **SC-005**: Core keyboard shortcuts work from the shell and do not trigger from normal text-entry targets.
- **SC-006**: Surface automated checks for the workbench pass, including static checks and the relevant unit or end-to-end tests for shell, preferences, palette, settings, and reading behavior.
- **SC-007**: Accessibility evidence documents keyboard coverage, text alternatives, reduced-motion handling, and bilingual N/A rationale before the feature is marked complete.

## Assumptions

- Surface remains a static SvelteKit SPA served by spine and communicates with spine only through relative `/api/*` calls.
- Existing Authentik and dev proxy behavior remain unchanged; this feature does not add new auth routes or bypasses.
- The scope is hardening and completing the current workbench surfaces, not a full visual redesign or a new multi-route application model.
- Existing spine endpoints for captures, search, files, working docs, attachments, tasks, and status are available or can be mocked in Surface tests.
- Mobile and narrow viewport behavior must keep primary workbench actions reachable, but advanced desktop two-pane workflows may remain optimized for larger screens.
- English-only UI copy is acceptable for this feature unless a future localization initiative introduces translation resources.
