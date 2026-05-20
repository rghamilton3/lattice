# task_completion

After any coding change, run:

```bash
bun test          # run full test suite
```

No separate lint or type-check step is configured yet. Bun's TypeScript execution catches type errors at runtime during tests.

If TypeBox validation schemas are changed, manually verify the affected route still rejects invalid payloads.

No formatter is configured in `package.json`; apply consistent style by hand (see `mem:conventions`).
