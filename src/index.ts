import { Elysia, t } from "elysia";
import { timingSafeEqual } from "node:crypto";
import { initDb } from "./db";

const db = initDb();

const AGENT_TOKEN = process.env.LATTICE_AGENT_TOKEN;
// Fail closed: HTTPS is enforced unless ALLOW_HTTP=true is explicitly set (local dev only).
const ALLOW_HTTP = process.env.ALLOW_HTTP === "true";
// When set, bypasses Authelia forward-auth and injects this value as Remote-User (local dev only).
const DEV_USER = process.env.DEV_USER;

if (!AGENT_TOKEN) {
  console.warn("WARNING: LATTICE_AGENT_TOKEN not set — all agent routes will reject");
}

function tokenMatches(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  return timingSafeEqual(Buffer.from(a), Buffer.from(b));
}

interface CaptureRow {
  id: number;
  text: string;
  source: string;
  captured_at: string;
  ingested_at: string;
}

function escHtml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function renderInbox(captures: CaptureRow[]): string {
  const rows = captures
    .map(
      (c) =>
        `<tr><td>${c.id}</td><td>${escHtml(c.text)}</td><td>${escHtml(c.source)}</td><td>${c.captured_at}</td></tr>`
    )
    .join("\n");
  return `<!doctype html>
<html>
<head>
<meta charset="utf-8">
<title>Lattice Inbox</title>
<style>
body { font-family: monospace; padding: 1rem; max-width: 960px; margin: 0 auto; }
h1 { font-size: 1.2rem; }
table { border-collapse: collapse; width: 100%; margin-top: 1rem; }
td, th { border: 1px solid #ccc; padding: 4px 8px; text-align: left; vertical-align: top; }
th { background: #eee; }
td:nth-child(2) { max-width: 600px; white-space: pre-wrap; word-break: break-word; }
</style>
</head>
<body>
<h1>Lattice Inbox</h1>
<table>
<thead><tr><th>ID</th><th>Text</th><th>Source</th><th>Captured At</th></tr></thead>
<tbody>${rows}</tbody>
</table>
</body>
</html>`;
}

const app = new Elysia()
  .get("/ping", () => ({ ok: true }))
  .get("/", () => {
    const captures = db
      .query(
        "SELECT id, text, source, captured_at, ingested_at FROM captures ORDER BY ingested_at DESC LIMIT 50"
      )
      .all() as CaptureRow[];
    return new Response(renderInbox(captures), {
      headers: { "content-type": "text/html" },
    });
  })

  .guard(
    {
      beforeHandle({ headers, set }) {
        if (!ALLOW_HTTP && headers["x-forwarded-proto"] !== "https") {
          set.status = 400;
          return "HTTPS required";
        }
        if (DEV_USER) {
          headers["remote-user"] = DEV_USER;
        } else if (!headers["remote-user"]) {
          set.status = 401;
          return "Unauthorized";
        }
      },
    },
    (app) =>
      app
        .get(
          "/api/captures",
          ({ query }) => {
            const limit = Math.min(Number(query.limit) || 50, 200);
            return db
              .query(
                "SELECT id, text, source, captured_at, ingested_at FROM captures ORDER BY ingested_at DESC LIMIT ?"
              )
              .all(limit) as CaptureRow[];
          },
          { query: t.Object({ limit: t.Optional(t.String()) }) }
        )
  )

  .group("/api/agent", (app) =>
    app.guard(
      {
        beforeHandle({ headers, set }) {
          if (!ALLOW_HTTP && headers["x-forwarded-proto"] !== "https") {
            set.status = 400;
            return "HTTPS required";
          }
          const authHeader = headers["authorization"] ?? "";
          const token = authHeader.startsWith("Bearer ")
            ? authHeader.slice(7)
            : "";
          if (!AGENT_TOKEN || !tokenMatches(token, AGENT_TOKEN)) {
            set.status = 401;
            return "Unauthorized";
          }
        },
      },
      (app) =>
        app
          .post(
            "/capture",
            ({ body }) => {
              const row = db
                .prepare(
                  "INSERT INTO captures (text, source, captured_at, ingested_at) VALUES (?, ?, ?, ?) RETURNING id"
                )
                .get(
                  body.text,
                  body.source,
                  body.captured_at,
                  new Date().toISOString()
                ) as { id: number };
              return { id: row.id };
            },
            {
              body: t.Object({
                text: t.String({ minLength: 1 }),
                source: t.String({ minLength: 1 }),
                captured_at: t.String({ minLength: 1 }),
              }),
            }
          )
          .post(
            "/index",
            ({ body }) => {
              db.prepare(
                `INSERT INTO file_index
                   (machine_id, path, hash, mime_type, text, modified_at, size_bytes, indexed_at)
                 VALUES (?, ?, ?, ?, ?, ?, ?, ?)
                 ON CONFLICT(machine_id, path) DO UPDATE SET
                   hash       = excluded.hash,
                   mime_type  = excluded.mime_type,
                   text       = excluded.text,
                   modified_at = excluded.modified_at,
                   size_bytes = excluded.size_bytes,
                   indexed_at = excluded.indexed_at
                 WHERE excluded.hash != file_index.hash`
              ).run(
                body.machine_id,
                body.path,
                body.hash,
                body.mime_type,
                body.text,
                body.modified_at,
                body.size_bytes,
                new Date().toISOString()
              );
              return { ok: true };
            },
            {
              body: t.Object({
                machine_id: t.String({ minLength: 1 }),
                path: t.String({ minLength: 1 }),
                hash: t.String({ minLength: 1 }),
                mime_type: t.String({ minLength: 1 }),
                text: t.String(),
                modified_at: t.String({ minLength: 1 }),
                size_bytes: t.Integer({ minimum: 0 }),
              }),
            }
          )
    )
  )

  .guard(
    {
      beforeHandle({ headers, set }) {
        if (!ALLOW_HTTP && headers["x-forwarded-proto"] !== "https") {
          set.status = 400;
          return "HTTPS required";
        }
        if (DEV_USER) {
          headers["remote-user"] = DEV_USER;
        } else if (!headers["remote-user"]) {
          set.status = 401;
          return "Unauthorized";
        }
      },
    },
    (app) =>
      app.get(
        "/api/search",
        ({ query, set }) => {
          if (!query.q) {
            set.status = 400;
            return { error: "q is required" };
          }
          // TODO: delegate to QMD vector search once integrated
          return { results: [] };
        },
        { query: t.Object({ q: t.Optional(t.String()) }) }
      )
  )

  .listen({ port: 3000, hostname: "127.0.0.1" });

console.log(`Spine listening on http://127.0.0.1:${app.server?.port}`);
