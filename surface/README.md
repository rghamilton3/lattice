# surface

SPA workbench for [Lattice](https://github.com/rghamilton3/lattice) — a personal knowledge management system. Built with [Svelte 5](https://svelte.dev) (runes mode) and [SvelteKit](https://kit.svelte.dev), using [`adapter-static`](https://github.com/sveltejs/kit/tree/main/packages/adapter-static) to emit static files served by [spine](../spine).

Provides search, reading panes, and working-doc editing over the spine REST API.

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

## Key dependencies

| Package | Use |
|---------|-----|
| `@tanstack/svelte-query` | Server state (API calls to spine) |
| `codemirror` + `@codemirror/lang-markdown` | Working-doc editor |
| `marked` + `marked-katex-extension` | Render markdown + LaTeX |
| `katex` | LaTeX math rendering |
| `mermaid` | Mermaid diagram rendering |
| `dompurify` | Sanitize rendered HTML |
| `pdfjs-dist` | PDF preview in reading panes |
| `tailwindcss` v4 | Styling |
