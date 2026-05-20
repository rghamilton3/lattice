# suggested_commands

```bash
bun run dev              # dev server with hot reload (--watch flag via package.json script)
bun run src/index.ts     # run directly without watch
bun test                 # run all tests (Bun built-in test runner)
bun test src/foo.test.ts # run a single test file
```

No separate build step — Bun runs TypeScript natively. No `tsc` invocation needed.
