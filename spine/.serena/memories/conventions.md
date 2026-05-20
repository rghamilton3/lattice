# conventions

- **No ORM** — raw SQL via `bun:sqlite` only
- **Schema changes** — only via numbered migration files in `migrations/`; never `ALTER TABLE` ad-hoc
- **Request validation** — TypeBox schemas on all agent-facing endpoints; validate at the HTTP boundary, not inside business logic
- **Idempotency** — indexer upserts use `INSERT OR REPLACE` (or `ON CONFLICT`) on `(machine_id, path, hash)`; re-sends must be silent no-ops
- **Auth middleware** — two separate middleware paths; `/api/agent/*` checks Bearer token; everything else trusts `Remote-User` header
- **Fail closed** — reject requests without required auth headers; never fall through to an unprotected handler
- **No comments** — code should be self-documenting via naming; only add a comment when the WHY is non-obvious
- **TypeScript strict** — strict mode is on; no `any` escape hatches
- **File encoding**: utf-8
