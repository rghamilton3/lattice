## What surface is

Surface is the SvelteKit SPA for Lattice. It is built to static files (`surface/build/`) and served by spine from `/`.
In production it talks to spine via relative `/api/*` paths. In dev, Vite proxies `/api` to `localhost:3000` and
automatically injects the `x-authentik-username: dev` header so no auth setup is needed.

## Commands

```bash
bun run dev       # dev server on port 5173 (proxies /api to spine at :3000)
bun run build     # build static files to build/
bun run check     # svelte-check + tsc
bun run lint      # prettier + eslint
bun run format    # prettier --write .
bun run test      # unit tests (vitest) + e2e (playwright)
bun run test:unit # vitest only
bun run test:e2e  # playwright only
```

From the monorepo root: `just dev` runs spine + surface together.

## Architecture

- **Framework**: SvelteKit with `@sveltejs/adapter-static` (no SSR; fully static output)
- **Styling**: Tailwind CSS v4 (Vite plugin, no config file)
- **Server state**: TanStack Query (`@tanstack/svelte-query`) for all API calls
- **Editor**: CodeMirror 6 with Vim bindings (`@replit/codemirror-vim`) and Markdown mode
- **Rich text rendering**: `marked` + KaTeX + Mermaid + `dompurify`
- **PDF viewer**: `pdfjs-dist`

## Directory structure

```
src/
  routes/           single SvelteKit route (+page.svelte, +layout.svelte)
  lib/
    api/            typed fetch wrappers for each spine endpoint
    state/          Svelte 5 runes-based UI state (workbench.svelte.ts, etc.)
    styles/         shared CSS
    utils/          helpers
    types.ts        shared TypeScript types
  components/
    editor/         CodeMirror editor wrapper
    home/           inbox / capture list
    icons/          SVG icon components
    overlays/       modal/drawer overlays
    process/        capture triage flow
    reading/        document reading view
    search/         search UI
    shell/          app shell (nav, layout)
    tasks/          task management view
    ui/             generic UI primitives
    workbench/      working doc editor
```

## Dev proxy

`vite.config.ts` proxies all `/api` requests to `http://localhost:3000` and injects:

- `x-forwarded-proto: https` (satisfies spine's HTTPS enforcement)
- `x-authentik-username: dev` (bypasses Authentik auth)

Spine must be running with `ALLOW_HTTP=true DEV_USER=dev` for this to work end-to-end.

## Testing

Unit tests (`*.svelte.test.ts`) run in a headless Chromium browser via `@vitest/browser-playwright`.
Server-side tests (`*.test.ts`) run in Node. E2E tests live in `e2e/` and use Playwright.

---

## Svelte MCP Tools

You have access to a Svelte MCP server with comprehensive Svelte 5 and SvelteKit documentation.

### 1. list-sections

Use this FIRST to discover all available documentation sections. Returns a structured list with titles, use_cases, and paths.
When asked about Svelte or SvelteKit topics, ALWAYS use this tool at the start of the chat to find relevant sections.

### 2. get-documentation

Retrieves full documentation content for specific sections. Accepts single or multiple sections.
After calling the list-sections tool, you MUST analyze the returned documentation sections (especially the use_cases field) and then use the get-documentation tool to fetch ALL documentation sections that are relevant for the user's task.

### 3. svelte-autofixer

Analyzes Svelte code and returns issues and suggestions.
You MUST use this tool whenever writing Svelte code before sending it to the user. Keep calling it until no issues or suggestions are returned.

### 4. playground-link

Generates a Svelte Playground link with the provided code.
After completing the code, ask the user if they want a playground link. Only call this tool after user confirmation and NEVER if code was written to files in their project.
