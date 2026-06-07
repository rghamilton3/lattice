# Tech Stack - Lattice

**Last Updated**: 2026-06-07
**Auto-Generated**: Yes

<!--
  Sections wrapped in the `ss:user-additions` ... `ss:end` HTML comment markers
  (see below) are preserved verbatim when /ss:init is re-run. Edit freely inside
  those blocks. The rest of the file is regenerated from project detection on
  each /ss:init.

  Lattice is a polyglot monorepo with three components:
    - spine/   TypeScript / Bun / Elysia  (central server, SQLite, REST API)
    - surface/ SvelteKit / Tailwind        (browser SPA)
    - agent/   Rust                         (local file indexer + system tray)
  The canonical single-slot fields below carry the dominant value; the full
  per-component breakdown lives in the "Components" section.
-->

---

## Core Technologies

### Framework
- **Elysia** 1.4
  - spine: localhost-only REST API server on Bun
- **SvelteKit** 2.57
  - surface: browser SPA, static-adapter build served by spine; Svelte 5 runes

### Language
- **Rust** edition-2024
  - agent: local file indexer, IPC, system tray (Unix + Windows)
- **TypeScript** 6.0
  - spine + surface; strict mode, ESM only

### Build Tool
- **Bun** 1.3
  - spine runtime, test runner, package manager
- **Cargo**
  - agent build (multiple binaries: lattice-agent, lattice-tray, lattice-capture, lattice-config)
- **Vite** 8.0
  - surface dev server and production build

---

## State Management

- **@tanstack/svelte-query** 6.1
  - Purpose: server-state caching and request orchestration in surface
  - Notes: local UI state uses Svelte 5 runes ($state / $derived); no external store library

---

## Styling

- **Tailwind CSS** 4.2
  - Purpose: utility-first styling in surface via @tailwindcss/vite
  - Notes: @tailwindcss/forms and @tailwindcss/typography plugins; prettier-plugin-tailwindcss enforces class ordering

---

## Testing

### Unit Testing
- **Vitest** 4.1
  - Purpose: surface component and unit tests (browser mode via @vitest/browser-playwright)
- **bun test**
  - Purpose: spine server and unit tests

### Integration Testing
- **bun test** 1.3
  - Purpose: spine API and search/database integration tests

### End-to-End Testing
- **Playwright** 1.59
  - Purpose: surface full-application-flow E2E tests

---

## Approved Libraries

### spine (TypeScript / Bun)
- Elysia + @elysiajs/static (server, static file serving)
- @tobilu/qmd (embedding / retrieval / structured search)
- smol-toml (config parsing)
- Built-in `bun:sqlite` for the SQLite database

### surface (SvelteKit)
- CodeMirror 6 (@codemirror/*, @replit/codemirror-vim) for the working-doc editor
- marked + marked-katex-extension + katex (markdown + math rendering)
- dompurify (HTML sanitization)
- mermaid (diagram rendering)
- pdfjs-dist (PDF preview)

### agent (Rust)
- rusqlite (bundled SQLite), notify-rust, walkdir, glob, blake3 (content hashing)
- reqwest (rustls-tls, no OpenSSL), tokio, serde / serde_json, toml / toml_edit
- eframe (gui feature), rfd (file dialogs), ksni (Unix tray), tray-icon + windows-sys (Windows tray)

<!-- ss:user-additions -->
<!-- Add project-specific approved libraries below. Content here is preserved on /ss:init re-run. -->
<!-- ss:end -->

---

## Prohibited Technologies

The following technologies/patterns are **NOT** approved for this project:

### State management
- Redux / MobX (use @tanstack/svelte-query + Svelte 5 runes instead)

### Source language
- New JavaScript source files under `surface/src` or `spine/src` (TypeScript only; enforced by constitution P1)
- Svelte legacy stores / class-component patterns where runes apply

### Networking / data
- Binding spine to any non-localhost interface (Caddy is the only external-facing process)
- Calling QMD `structuredSearch` (pre-expanded `queries`) with un-normalized document content (see constitution P2 and project memory)
- OpenSSL-linked HTTP in agent (reqwest is pinned to rustls-tls)

<!-- ss:user-additions -->
<!-- Add project-specific prohibited patterns below. Content here is preserved on /ss:init re-run. -->
<!-- ss:end -->

---

## Guidelines

### Adding New Dependencies

Before adding a new dependency:
1. Check if existing approved libraries can solve the problem
2. Verify the library is actively maintained
3. Check bundle size impact (surface ships to the browser)
4. Ensure TypeScript support (spine / surface) or a maintained crate (agent)
5. Keep the agent's dependency tree free of OpenSSL (rustls-tls only)

### Version Updates

- Follow semver for all dependencies
- Test thoroughly before updating major versions (`just test`, `just lint`, `just check`)
- Document breaking changes in this file
- Update CI/CD pipelines if needed

---

## Components

| Component | Language | Runtime / Framework | Build | Tests |
|-----------|----------|---------------------|-------|-------|
| `spine/`   | TypeScript | Bun + Elysia        | Bun   | `bun test` |
| `surface/` | TypeScript | SvelteKit 5         | Vite  | Vitest + Playwright |
| `agent/`   | Rust 2024  | tokio + eframe/ksni | Cargo | `cargo test` |

Monorepo orchestration is via the `Justfile` (`just dev`, `just test`, `just lint`, `just fmt`, `just check`).

---

## Notes

- This file was auto-detected from spine/package.json, surface/package.json, and agent/Cargo.toml and created by `/ss:init`
- Update this file when adding new technologies or patterns
- Run `/ss:init` again to update with new detections

<!-- ss:user-additions -->
<!-- Add project-specific notes below. Content here is preserved on /ss:init re-run. -->
<!-- ss:end -->

---

**Tech Stack Enforcement**: This file is used by SpecSwarm to prevent technology drift. Commands like `/ss:build` and `/ss:implement` will reference this file to ensure consistency across features.
