# Research: Surface Workbench

## Decision: Preserve The Existing Static SPA Workbench

**Rationale**: Surface is already a SvelteKit static app served by spine and routed through a single shell. The feature asks for the SPA shell, search, reading panes, posture, command palette, deep links, themes, and focused knowledge work; these align with the existing `+layout.svelte`, `+page.svelte`, `WorkbenchShell`, `AppShell`, and `WorkbenchStore` structure. Keeping the current shape avoids unnecessary routing or infrastructure changes.

**Alternatives considered**:

- Add separate SvelteKit routes for each workbench view: rejected because the current static fallback and pane model already handle deep links and multi-pane state.
- Introduce a global router/store dependency: rejected because Svelte 5 runes and current typed state are sufficient.

## Decision: Keep UI State In A Runes-Based Workbench Store

**Rationale**: The existing `WorkbenchStore` uses Svelte 5 runes for panes, focused pane, overlays, preferences, posture, and toasts. This matches project guidance and keeps UI state local to Surface without crossing component boundaries.

**Alternatives considered**:

- Use Svelte stores or a state machine library: rejected as unnecessary abstraction for the current number of states.
- Persist active pane contents: deferred because persisted references can become stale and the spec only requires preference persistence.

## Decision: Use TanStack Query For Server Data

**Rationale**: Existing API access for status, captures, files, search, tasks, working docs, and attachments already uses TanStack Query and typed fetch wrappers. Workbench hardening should improve loading/error behavior and invalidation, not add another data layer.

**Alternatives considered**:

- Manual fetch state per component: rejected because it would duplicate retry/loading/error patterns.
- Direct spine data imports: prohibited by component-boundary governance.

## Decision: Keep The Calm Lattice Visual Language

**Rationale**: The existing themes, density tokens, posture language, and muted shell are specifically suited to an ADHD-aware workspace. The design work should refine responsiveness, labels, hierarchy, and feedback while avoiding a full redesign.

**Alternatives considered**:

- A visually dramatic new workbench shell: rejected because it would conflict with established product intent and increase implementation risk.

## Decision: Treat Accessibility As A Core Workbench Contract

**Rationale**: The shell relies heavily on icon buttons, overlays, keyboard shortcuts, and status text. Accessibility evidence and tests should explicitly cover labels, keyboard behavior, reduced motion, and non-color feedback.

**Alternatives considered**:

- Manual visual review only: rejected because keyboard and label regressions are easy to introduce in a dense UI.

## Decision: Bilingual Delivery Is Not Required

**Rationale**: Surface currently has English-only product copy and no translation framework. The feature should document this N/A decision rather than introduce partial localization.

**Alternatives considered**:

- Add translation infrastructure now: rejected as outside scope and a new abstraction without current product support.
