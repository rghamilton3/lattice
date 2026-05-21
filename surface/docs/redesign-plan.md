# Lattice Surface — Redesign Plan

The React tree in `/surface/design/` is the visual + interaction spec for a redesigned Surface SPA. This document maps that spec onto the current Svelte codebase and flags what ships now vs what's blocked on spine work. Pixel/behaviour questions: read the matching `.jsx` directly — don't re-describe in prose.

The current Svelte app is a two-pane workbench rooted at `+page.svelte` → `WorkbenchShell.svelte`, with one pane kind for search and one for documents. The redesign adds a Home view, three overlays (capture, command palette, settings), a ProcessMode full-bleed triage flow, and a theme/density/font system driven by `data-*` attrs on `<html>`. State that today lives in three or four `$state` rune cells expands to ~15.

## 1. Component map: React → Svelte

| Design (`/surface/design/*.jsx`) | Lines   | Svelte target                                                                                                                                          | Status                      |
| -------------------------------- | ------- | ------------------------------------------------------------------------------------------------------------------------------------------------------ | --------------------------- |
| `app.jsx` `App`                  | 43–272  | `+page.svelte` thin wrapper + `routes/+layout.svelte` already there; new shell wrapper inside `WorkbenchShell.svelte` (or rename to `AppShell.svelte`) | rewrite                     |
| `Shell.jsx` `Shell`              | 11–104  | `src/components/shell/AppShell.svelte` — toolbar (48px) + main + statusbar (28px)                                                                      | new                         |
| `Shell.jsx` `NavBtn`             | 106–115 | `src/components/shell/NavBtn.svelte`                                                                                                                   | new                         |
| `Shell.jsx` `PaneHead`           | 120–165 | inline in `PaneContainer.svelte` (already has title bar)                                                                                               | extend existing             |
| `HomeView.jsx` `HomeView`        | 12–249  | `src/components/home/HomeView.svelte` — new pane kind `home`                                                                                           | new                         |
| `HomeView.jsx` `NowCard`         | 112–136 | `src/components/home/NowCard.svelte`                                                                                                                   | new                         |
| `HomeView.jsx` `InboxList`       | 138–185 | `src/components/home/InboxList.svelte`                                                                                                                 | new                         |
| `HomeView.jsx` `TriageBtn`       | 187–199 | `src/components/home/TriageBtn.svelte`                                                                                                                 | new                         |
| `HomeView.jsx` `Resurfaced`      | 201–230 | `src/components/home/Resurfaced.svelte`                                                                                                                | new — feature-flagged off   |
| `HomeView.jsx` `PostureToggle`   | 232–245 | `src/components/home/PostureToggle.svelte`                                                                                                             | new                         |
| `SearchView.jsx` `SearchView`    | 10–140  | extend existing `src/components/search/SearchPane.svelte` — add facets sidebar, cluster filter, kind filter                                            | extend                      |
| `SearchView.jsx` `ResultRow`     | 143–181 | extend existing `src/components/search/ResultList.svelte` (already has lateral actions)                                                                | extend                      |
| `DocView.jsx` `DocView`          | 9–75    | `src/components/reading/DocView.svelte` — orchestrator that picks ReadingPane vs EditorPane and shows the lateral toolbar                              | new wrapper                 |
| `DocView.jsx` `ReadingBody`      | 117–166 | reuse existing `ReadingPane.svelte` (already covers all three doc kinds incl. PDF)                                                                     | reuse                       |
| `DocView.jsx` `Editor`           | 237–289 | reuse existing `EditorPane.svelte` — keep CodeMirror + vim config byte-identical                                                                       | reuse                       |
| `DocView.jsx` `RelatedRail`      | 168–200 | `src/components/reading/RelatedRail.svelte` — bottom strip on reading mode                                                                             | new                         |
| `DocView.jsx` `ProseMarkdown`    | 202–234 | reuse existing `MarkdownRenderer.svelte` (Marked + KaTeX + Mermaid + DOMPurify)                                                                        | reuse                       |
| `DocView.jsx` `LateralResults`   | 292–335 | reuse existing `ResultList.svelte` with `source` prop (already wired for similar/mentions/nearby)                                                      | reuse                       |
| `DocView.jsx` `ResultRowLite`    | 337–369 | extend `ResultList.svelte` row variant                                                                                                                 | extend                      |
| `Overlays.jsx` `QuickCapture`    | 9–78    | `src/components/overlays/QuickCapture.svelte`                                                                                                          | new — mock send for phase 1 |
| `Overlays.jsx` `CommandPalette`  | 82–177  | `src/components/overlays/CommandPalette.svelte`                                                                                                        | new                         |
| `Overlays.jsx` `Settings`        | 180–246 | `src/components/overlays/Settings.svelte`                                                                                                              | new                         |
| `ProcessMode.jsx` `ProcessMode`  | 11–99   | `src/components/process/ProcessMode.svelte`                                                                                                            | new — feature-flagged off   |
| `ProcessMode.jsx` `CaptureCard`  | 101–123 | inline in `ProcessMode.svelte`                                                                                                                         | new                         |
| `ProcessMode.jsx` `DoneCard`     | 136–160 | inline in `ProcessMode.svelte`                                                                                                                         | new                         |
| `icons.jsx` `Icon` + `relTime`   | 1–145   | `src/components/icons/Icon.svelte` (switch on name → inline SVG) + `src/lib/utils/relTime.ts`                                                          | new                         |
| `styles.css`                     | full    | merge into `src/routes/layout.css` — replace the Catppuccin Mocha `@theme` block with the three-theme tokens; keep Tailwind v4 for layout utilities    | rewrite                     |
| `components.css`                 | full    | break into colocated `<style>` blocks per Svelte component, or one `src/lib/styles/components.css` if global selectors are needed                      | rewrite                     |
| `data.js`                        | full    | dev-only `src/lib/dev/mockData.ts` (DO NOT ship to prod); switch each consumer to real TanStack queries once endpoint exists                           | scaffolding                 |

## 2. New state — `WorkbenchStore` extension

`WorkbenchStore` (`src/lib/state/workbench.svelte.ts`) currently holds `panes`, `focusedPane`, `vimMode` (3 fields). Add the following — same class, runes-based, single source of truth — and add `localStorage` persistence (the React reference persists to `lattice.session` minus transient overlay flags, see `app.jsx:60–63`).

| Field                 | Type                                       | Default         | Persisted                                          | Purpose                                                                      |
| --------------------- | ------------------------------------------ | --------------- | -------------------------------------------------- | ---------------------------------------------------------------------------- |
| `theme`               | `'light' \| 'dark' \| 'sepia'`             | `'light'`       | yes                                                | sets `<html data-theme>`                                                     |
| `density`             | `'compact' \| 'comfortable' \| 'spacious'` | `'comfortable'` | yes                                                | sets `<html data-density>`                                                   |
| `font`                | `string`                                   | `'Inter'`       | yes                                                | sets `--font-ui`/`--font-reading` on `<html>`                                |
| `posture`             | `'quiet' \| 'standard' \| 'active'`        | `'quiet'`       | yes                                                | shows/hides notification counts on Home                                      |
| `focusMode`           | `boolean`                                  | `false`         | yes                                                | fades toolbar + statusbar via CSS                                            |
| `view`                | `'home' \| 'search' \| 'doc'`              | `'home'`        | yes                                                | breadcrumb + nav highlight (panes[].kind is the source of truth for content) |
| `triageMode`          | `boolean`                                  | `false`         | **no — deliberate deviation from spec** (see note) | full-bleed ProcessMode replaces workbench                                    |
| `dismissedCaptureIds` | `number[]`                                 | `[]`            | yes                                                | filter for InboxList + ProcessMode queue                                     |
| `lastQuery`           | `string`                                   | `''`            | yes                                                | seeds SearchView input on return                                             |
| `toast`               | `{ id: number, msg: string } \| null`      | `null`          | no                                                 | auto-clear after 2.6s (`app.jsx:99`)                                         |
| `captureOpen`         | `boolean`                                  | `false`         | no                                                 | QuickCapture visible                                                         |
| `paletteOpen`         | `boolean`                                  | `false`         | no                                                 | CommandPalette visible                                                       |
| `settingsOpen`        | `boolean`                                  | `false`         | no                                                 | Settings drawer visible                                                      |

Also extend `PaneContent` (`src/lib/types.ts:57–62`): add `{ kind: 'home' }`. Today the union is `empty | search | results | doc | editor`. Default pane on first load changes from `{ kind: 'search', query: '' }` (`workbench.svelte.ts:7`) to `{ kind: 'home' }`.

Keyboard surface (own a single `onMount` listener in `AppShell.svelte`, mirroring `app.jsx:67–95`):

- ⌘J → `captureOpen = true`
- ⌘⇧J → new working doc (already creates via `createWorking` mutation)
- ⌘K → `paletteOpen = true`
- ⌘. → toggle `focusMode`
- ⌘/ → `view = 'search'`, panes → `[{kind:'search',query:''}]`
- ⌃⌥V → `toggleVim()` (already implemented)
- Esc → close all overlay flags
- `c` (no modifier, not in input) → `captureOpen = true`
- ProcessMode-only: `k`/`a`/`p`/`t`/`␣` for triage actions

Persistence shape mirrors `app.jsx:61–62`: `JSON.stringify(state)` excluding `captureOpen`, `paletteOpen`, `settingsOpen`, `toast`, **and `triageMode`**.

**Deliberate deviations from the React spec, called out:**

- _`triageMode` is NOT persisted._ The React reference at `app.jsx:61` only destructures out `captureOpen, paletteOpen, toast, settingsOpen` from `persist`, which means `triageMode` lands in localStorage and a refresh mid-triage drops the user back into triage. That's almost certainly a spec bug — refresh during a focus-flow shouldn't trap you. Recommend dropping it from persistence. Flag for human override if they want literal spec behaviour.
- _Default theme is `'light'`._ This matches the React `TWEAK_DEFAULTS.theme` at `app.jsx:11`, but the current Svelte app is dark (Catppuccin Mocha). First build will flip the default. Existing users see a theme change on first load; recommend either keeping `'light'` to match the spec, or seeding `'dark'` as the default for continuity. Flag for human decision.

## 3. Mock endpoints in `/design` vs spine reality

The design fetches synchronously from `window.LATTICE_DATA` (defined in `data.js:6–202`). Cross-check against `src/lib/api/*`:

| Design mock                                             | Consumer line(s)                                                                | Spine endpoint                                                                 | Surface client (`lib/api`)             | TanStack key                          | Status                                                                                                                                                                         |
| ------------------------------------------------------- | ------------------------------------------------------------------------------- | ------------------------------------------------------------------------------ | -------------------------------------- | ------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `captures` (list)                                       | `HomeView.jsx:18,48`                                                            | `GET /api/captures?limit=`                                                     | `fetchCaptures` (`captures.ts:9`)      | `['captures','list',{limit}]`         | **ships now**                                                                                                                                                                  |
| `captures` (single)                                     | resolved via `data.captures.find()` in `DocView.jsx:78–115` (sync, list-filter) | `GET /api/captures/{id}`                                                       | `fetchCapture` (`captures.ts:13`)      | `['captures','detail',id]`            | **ships now** — note: React reads from already-loaded list synchronously; Svelte port issues a per-id query, so `ReadingPane` gets loading/error states the spec doesn't model |
| `localFiles` (single)                                   | `DocView.jsx:90–100`                                                            | `GET /api/files/{id}` + `/raw`                                                 | `fetchFile`, `rawFileUrl` (`files.ts`) | `['files','detail',id]`               | **ships now**                                                                                                                                                                  |
| `localFiles` (list)                                     | command palette `Overlays.jsx:115`                                              | —                                                                              | no list endpoint                       | —                                     | **mock-only** (palette can omit files until/unless spine ships a list)                                                                                                         |
| `workingDocs` (list)                                    | `HomeView.jsx:15–16,86`                                                         | `GET /api/working`                                                             | `fetchWorkingList` (`working.ts:9`)    | `['working','list']`                  | **ships now**                                                                                                                                                                  |
| `workingDocs` (single)                                  | `DocView.jsx:103`                                                               | `GET /api/working/{slug}`                                                      | `fetchWorking` (`working.ts:13`)       | `['working','detail',slug]`           | **ships now**                                                                                                                                                                  |
| `searchResults[q]`                                      | `SearchView.jsx:17`, `ResultRow:143`                                            | `GET /api/search?q=`                                                           | `fetchSearch` (`search.ts:11`)         | `['search', q]`                       | **ships now** — note design's score/cluster fields; current `SearchResult` (`types.ts:3–6`) has `score` and `snippet`, no `cluster` — see §4                                   |
| `related[key]`                                          | `RelatedRail` (`DocView.jsx:170`)                                               | `GET /api/similar?id=&kind=`                                                   | `fetchSimilar` (`search.ts:15`)        | `['similar',{id,kind}]`               | **ships now**                                                                                                                                                                  |
| `lateral.similar[key]`                                  | `LateralResults` (`DocView.jsx:294`)                                            | `GET /api/similar` (same as above)                                             | `fetchSimilar`                         | `['similar',{id,kind}]`               | **ships now**                                                                                                                                                                  |
| `lateral.mentions[key]`                                 | `DocView.jsx:296`                                                               | `GET /api/search?q=` (full-text reuse)                                         | `fetchSearch`                          | `['search', q]`                       | **ships now**                                                                                                                                                                  |
| `lateral.nearby[key]`                                   | `DocView.jsx:297`                                                               | `GET /api/nearby?timestamp=&window_hours=`                                     | `fetchNearby` (`search.ts:22`)         | `['nearby',{timestamp,window_hours}]` | **ships now**                                                                                                                                                                  |
| `today`                                                 | `HomeView.jsx:14`, `DocView.jsx:11`, `ProcessMode.jsx:22`                       | n/a — client-side `new Date()`                                                 | n/a                                    | n/a                                   | **ships now** (drop the mock)                                                                                                                                                  |
| `resurfaced`                                            | `HomeView.jsx:18,70`                                                            | —                                                                              | —                                      | —                                     | **mock-only** — needs spine endpoint                                                                                                                                           |
| `clusters`                                              | `SearchView.jsx:13,64`                                                          | —                                                                              | —                                      | —                                     | **mock-only** — needs spine endpoint (or compute client-side from `SearchResult.cluster` once added)                                                                           |
| capture create (QuickCapture save)                      | `app.jsx:251` toast only                                                        | no spine endpoint via surface client                                           | —                                      | —                                     | **mock-only** — no `createCapture` in `lib/api/captures.ts` (line 1–15); spine may already accept POST but surface doesn't call it                                             |
| capture triage actions (Keep/Archive/Promote/Task/Skip) | `HomeView.jsx:175–179`, `ProcessMode.jsx:101–123`                               | partial — Promote → `createWorking({seed_capture_id})` ships (`working.ts:24`) | —                                      | —                                     | **partial** — Promote ships via existing `createWorking`; Archive/Task/Skip have no endpoint, currently optimistic-local via `dismissedCaptureIds`                             |
| "new working doc" (⌘⇧J)                                 | `app.jsx:119–121` (toast only)                                                  | `POST /api/working`                                                            | `createWorking` (`working.ts:24`)      | mutation                              | **ships now** — already wired in `WorkbenchShell.svelte:38`                                                                                                                    |

## 4. Feature-flagged off / mock-only (phase 1 dark)

Ship these as components but gate behind a runtime flag (`PUBLIC_LATTICE_FEATURE_*` env var or a `featureFlags` store):

1. **Resurfaced rail on Home** — no spine endpoint exists. Render an empty/disabled card with a comment pointer until spine ships `GET /api/resurfaced`.
2. **Cluster facets on Search** — no `clusters` endpoint. Hide the facets sidebar in the meantime, or derive clusters client-side from `SearchResult` if/when spine adds a `cluster` field to results (`types.ts:3–6` would gain `cluster?: string`).
3. **ProcessMode** — UI ships, but Archive/Task/Skip have no spine endpoints. Wire only Promote (`createWorking`). Keep/Skip are local-only (`dismissedCaptureIds`). Flag-gate the "Process N in M min" button on Home.
4. **QuickCapture save** — overlay UI ships, but there's no `createCapture` in `lib/api/captures.ts`. Either:
   - phase 1: show a toast saying "captured locally" and store to a session-only buffer (no persistence), or
   - block on spine adding `POST /api/captures` (and surface adding `createCapture` mutation).
5. **Voice capture toggle inside QuickCapture** (`Overlays.jsx:11`) — no transport. Hide the toggle until there's a story for voice → spine.

## 5. Risk register

The five things most likely to regress during the port, ordered by blast radius:

1. **CodeMirror + Vim** (`EditorPane.svelte:10,22,64–116`). Extensions list, vim Compartment, ex commands (`:w`, `:wq`, `:q`, `:q!`), `Ctrl-s` keymap, autosave 1500ms debounce, and `EditorView.theme({...})` colour vars must stay byte-identical. The redesign adds a status-bar "vim on/off" indicator (`DocView.jsx:273`) — read-only display, no rewiring. **Verification:** open a working doc, type `i`, type text, `<Esc>`, `:w<Enter>`, confirm save status flips to "saved"; toggle vim off via ⌃⌥V, confirm normal-mode keys insert text.
2. **TanStack query keys** (`search.ts:4–9`, `captures.ts:4–7`, `files.ts`, `working.ts:4–7`). Any string drift breaks cache invalidation in `WorkbenchShell.svelte:38`, `EditorPane.svelte:42`, `ReadingPane.svelte:94`. **Verification:** after redesign, save a doc → list query auto-revalidates; create a doc → list shows new entry without manual refresh.
3. **PDF viewer** (`PdfViewer.svelte`, lines 1–48). Worker URL loaded via `?url` import; redesign's prose-only `ReadingBody` (`DocView.jsx:117–166`) does NOT replace PDF rendering — the existing branch in `ReadingPane.svelte` must still dispatch to `PdfViewer` for `mime_type: 'application/pdf'`. **Verification:** open a PDF capture, confirm pages render at 1.5× scale.
4. **Theme system collision** (`routes/layout.css` Catppuccin Mocha `@theme` block vs design's `styles.css` three-theme tokens). Tailwind v4's `@theme` and the design's `[data-theme=...]` selectors must coexist. Simplest path: drop Catppuccin tokens, port the three-theme oklch palette into `@theme` defaults + `[data-theme="dark"]`/`[data-theme="sepia"]` overrides; Tailwind utility classes (`prose`, `prose-invert`, `prose-sm` in `MarkdownRenderer.svelte`) still need to resolve. **Verification:** toggle theme via Settings, screenshot Home + Doc; toggle density; switch font; reload to confirm persistence.
5. **Routing regressions from over-eager URL wiring.** The design has no router — only `view` enum + `panes[].kind` (`app.jsx:27,33`). Current Svelte is single `/` route (`+page.svelte`). Risk: during the port, someone reaches for `goto()`, hash routes, or `+page.svelte` per-view to "make navigation feel right" and breaks SPA reload semantics (adapter-static's `fallback: 'index.html'` already covers reload-to-deep-link, but only if state restores from `localStorage` — not from URL). **Verification:** reload mid-doc, confirm pane state restores; ⌘/ navigates to search without changing the URL bar; no `goto()` calls anywhere outside existing usages.

Lower-priority risks worth a glance:

- The design unifies read/edit into one `doc` pane with a `mode` flag (`app.jsx:103`); the current Svelte has separate `doc` and `editor` pane kinds (`types.ts:57–62`). **Recommendation:** keep the existing split — wire "edit this" in `ReadingPane.svelte` to call `wb.openInPane(i, {kind:'editor', slug})`. Equivalent UX, less refactor.
- `window.LATTICE_DATA` reads in the React tree are synchronous. Their TanStack-backed replacements are async. Components must handle loading/error/empty states (Home was synchronous in the spec, see `HomeView.jsx:18`).
- `data-theme` / `data-density` on `<html>` must be applied before first paint to avoid FOUC. Apply in `+layout.svelte`'s `onMount` _and_ via a small inline script in `app.html`.

## Recommended phase sequencing (for discussion)

Per CLAUDE-level direction: ship one phase at a time. After each: `bun run check`, `bun run lint`, screenshot the changed view, commit. Don't start phase N+1 until N is green. The ordering below is a recommendation, not a directive — it's biased toward "small risky thing first, then content, then chrome" so each phase is independently revertable. The human owns final phase shape.

- **Phase 1 — Tokens + shell:** port `styles.css` tokens into `layout.css`; introduce `AppShell.svelte` (toolbar + main + statusbar); apply `data-theme`/`data-density`/font on `<html>`; add `theme`/`density`/`font`/`focusMode` to `WorkbenchStore` with `localStorage`. No new views yet — Search pane still loads.
- **Phase 2 — Home view:** add `{kind:'home'}` to `PaneContent`, build `HomeView.svelte` + children (NowCard, InboxList, PostureToggle, working-docs grid). Resurfaced stays hidden behind flag. Make Home the default pane.
- **Phase 3 — Overlays:** QuickCapture (mock save), CommandPalette (wired to commands), Settings drawer. Keyboard shortcuts via single `AppShell.svelte` `onMount` listener.
- **Phase 4 — Search refresh:** facets sidebar wired to local filter state (clusters mocked or hidden), restyled ResultRow with score bar + lateral actions on existing `ResultList.svelte`.
- **Phase 5 — Doc view chrome:** `DocView.svelte` wrapper, `RelatedRail.svelte` using `fetchSimilar`, restyled lateral toolbar. ReadingPane + EditorPane + PdfViewer unchanged internally.
- **Phase 6 — ProcessMode:** behind flag. Wire Promote to `createWorking`; Keep/Skip/Archive/Task are local-only until spine endpoints exist.

## Verification (end-to-end, post-phase)

- `bun run check` clean (no svelte-check / type errors)
- `bun run lint` clean
- `bun run dev` — visit `/`:
  - Home loads with Inbox + Working grid (Resurfaced hidden if flag off)
  - ⌘K opens palette; arrow keys + Enter execute
  - ⌘J opens capture; ⌘↵ saves; Esc closes
  - ⌘/ switches to Search; type query; results render
  - Click result → opens in pane; "Similar" → lateral split; close right
  - "Edit this" on a working doc → CodeMirror loads with vim; `:w<Enter>` saves
  - Settings drawer toggles theme/density/font; reload preserves choices
- `bun run build` produces `dist/`; `bun run preview` serves it; same flow works as static SPA
- `bun run test:e2e` passes (existing Playwright tests)
