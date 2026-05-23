# surface

<img src="./static/favicon.svg" width="48" alt="Lattice icon">

[![CI surface](https://github.com/rghamilton3/lattice/actions/workflows/surface-ci.yml/badge.svg)](https://github.com/rghamilton3/lattice/actions/workflows/surface-ci.yml)

SPA workbench for [Lattice](https://github.com/rghamilton3/lattice) — a personal knowledge management system. Built with [Svelte 5](https://svelte.dev) (runes mode) and [SvelteKit](https://kit.svelte.dev), using [`adapter-static`](https://github.com/sveltejs/kit/tree/main/packages/adapter-static) to emit static files served by [spine](../spine).

Provides search, reading panes, working-doc editing, and file attachments over the spine REST API.

## Architecture

```
lattice/
├── spine/    ← central server (Bun/Elysia)
├── agent/    ← local file indexer (Rust)
└── surface/  ← you are here (SvelteKit SPA)
```

Built output lands in `build/` and is served by spine from `/`.

## Development

```bash
bun install
bun run dev              # Vite dev server on :5173
bun run build            # static export to build/
bun run preview          # preview the production build locally
```

The dev server expects spine at `http://localhost:3000` (configured via Vite proxy). Run `just dev` from the repo root to start both spine and surface together.

## Testing

```bash
bun test                 # unit + e2e (Vitest + Playwright)
bun run test:unit        # unit tests only
bun run test:e2e         # e2e tests with Playwright
```

## Checks & linting

```bash
bun run check            # svelte-check (type-checking)
bun run lint             # prettier + eslint
bun run format           # auto-format with prettier
```

## Keyboard

Global shortcuts (active outside text inputs):

| Key   | Action                                     |
| ----- | ------------------------------------------ |
| `c`   | Quick capture                              |
| `⌘J`  | Quick capture                              |
| `⌘⇧J` | New working doc                            |
| `⌘K`  | Command palette                            |
| `⌘.`  | Toggle focus mode (fade chrome)            |
| `⌘/`  | Jump to search                             |
| `⌃⌥V` | Toggle vim mode                            |
| `Esc` | Close any open overlay (capture / palette) |

Inside Process Mode (the triage flow) the keys are `k` keep · `a` archive · `p` promote · `t` task · `␣` skip · `Esc` exit.

## File attachments

Files can be attached to any capture or working doc. Use the **Attach** button in the reading pane toolbar (after the `|` separator). Attachments appear in a resizable, minimizable right rail alongside the document content. Filenames and metadata are indexed by QMD and searchable alongside all other content.

The global quick-capture overlay also accepts a file attachment, creating a new capture with the file in one step.

## Deep links

`adapter-static` serves the SPA from `index.html` for every path. The following query params restore state on first paint:

| Param                  | Effect                                 |
| ---------------------- | -------------------------------------- |
| `?view=home`           | Canonical landing — opens Home pane    |
| `?view=search`         | Opens search pane with empty query     |
| `?ref=working:my-slug` | Opens a working doc directly           |
| `?ref=capture:123`     | Opens capture #123 in the reading pane |
| `?ref=file:42`         | Opens file #42 in the reading pane     |

When no query params are present, `localStorage` (`lattice.session`) restores theme, density, font, posture, focus mode, vim mode, view, and the dismissed-capture set.

## Feature flags

Phase-1 dark features ship behind build-time env vars. Set any of these to `false` (or `0`) before `bun run build` to disable; anything else keeps the default:

| Variable                              | Default | Hides                                                                       |
| ------------------------------------- | ------- | --------------------------------------------------------------------------- |
| `PUBLIC_LATTICE_FEATURE_RESURFACING`  | `true`  | "From your past" rail on Home                                               |
| `PUBLIC_LATTICE_FEATURE_RELATED_RAIL` | `true`  | Related-doc rail at the bottom of the reading pane (resizable, minimizable) |
| `PUBLIC_LATTICE_FEATURE_TRIAGE`       | `true`  | "Process 10 in 5 min" button + ProcessMode flow                             |
| `PUBLIC_LATTICE_FEATURE_CLUSTERS`     | `false` | Cluster facet (no spine endpoint yet)                                       |

## Key dependencies

| Package                                    | Use                               |
| ------------------------------------------ | --------------------------------- |
| `@tanstack/svelte-query`                   | Server state (API calls to spine) |
| `codemirror` + `@codemirror/lang-markdown` | Working-doc editor                |
| `marked` + `marked-katex-extension`        | Render markdown + LaTeX           |
| `katex`                                    | LaTeX math rendering              |
| `mermaid`                                  | Mermaid diagram rendering         |
| `dompurify`                                | Sanitize rendered HTML            |
| `pdfjs-dist`                               | PDF preview in reading panes      |
| `tailwindcss` v4                           | Styling                           |
