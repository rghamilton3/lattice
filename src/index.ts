import { Elysia, t } from "elysia";
import { timingSafeEqual } from "node:crypto";
import { initDb } from "./db";
import { initSearch, writeCaptureFile, refreshIndex, search } from "./search";
import type { SearchResult } from "./search";

const db = initDb();
await initSearch(db);

const AGENT_TOKEN = process.env.LATTICE_AGENT_TOKEN;
const ALLOW_HTTP = process.env.ALLOW_HTTP === "true";
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

function stripFrontmatter(s: string): string {
  return s.startsWith("---") ? s.replace(/^---[\s\S]*?---\n*/, "") : s;
}

function escHtml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function renderPage(opts: {
  query?: string;
  results?: SearchResult[];
  captures?: CaptureRow[];
}): string {
  const { query = "", results, captures } = opts;

  let body: string;
  if (results) {
    if (results.length === 0) {
      body = `<p>No results for <em>${escHtml(query)}</em>.</p>`;
    } else {
      const items = results
        .map(
          (r) => `
<div class="result">
  <div class="meta">
    <span class="score">score: ${r.score.toFixed(3)}</span>
    &nbsp;·&nbsp; <span class="path">${escHtml(r.path)}</span>
  </div>
  <div class="snippet">${escHtml(stripFrontmatter(r.snippet))}</div>
  <details>
    <summary>Full text (capture #${r.id})</summary>
    <pre class="full">${escHtml(stripFrontmatter(r.body))}</pre>
  </details>
</div>`
        )
        .join("\n");
      body = `<div class="results">${items}</div>`;
    }
  } else {
    const rows = (captures ?? [])
      .map(
        (c) =>
          `<tr><td>${c.id}</td><td>${escHtml(c.text)}</td><td>${escHtml(c.source)}</td><td>${escHtml(c.captured_at)}</td></tr>`
      )
      .join("\n");
    body = `
<h2>Recent captures</h2>
<table>
<thead><tr><th>ID</th><th>Text</th><th>Source</th><th>Captured At</th></tr></thead>
<tbody>${rows}</tbody>
</table>`;
  }

  const clearLink = query ? ` &nbsp;<a href="/">Clear</a>` : "";

  return `<!doctype html>
<html>
<head>
<meta charset="utf-8">
<title>Lattice</title>
<style>
body { font-family: monospace; padding: 1rem; max-width: 960px; margin: 0 auto; }
h1, h2 { font-size: 1.2rem; margin: 0.5rem 0; }
form { margin: 1rem 0; display: flex; gap: 0.5rem; align-items: center; }
input[name=q] { flex: 1; padding: 4px 8px; font-family: monospace; font-size: 1rem; }
button { padding: 4px 12px; font-family: monospace; cursor: pointer; }
.result { border: 1px solid #ccc; margin-bottom: 0.75rem; padding: 8px; }
.meta { font-size: 0.85em; color: #666; margin-bottom: 4px; }
.score { color: #999; }
.snippet { background: #f9f9f9; padding: 6px; white-space: pre-wrap; word-break: break-word; }
.full { background: #f0f0f0; padding: 6px; white-space: pre-wrap; word-break: break-word; margin-top: 4px; }
details summary { cursor: pointer; margin-top: 4px; font-size: 0.9em; }
table { border-collapse: collapse; width: 100%; margin-top: 1rem; }
td, th { border: 1px solid #ccc; padding: 4px 8px; text-align: left; vertical-align: top; }
th { background: #eee; }
td:nth-child(2) { max-width: 600px; white-space: pre-wrap; word-break: break-word; }
</style>
</head>
<body>
<h1>Lattice</h1>
<form method="get" action="/">
  <input name="q" value="${escHtml(query)}" placeholder="Search captures…" autocomplete="off">
  <button type="submit">Search</button>${clearLink}
</form>
${body}
</body>
</html>`;
}

const app = new Elysia()
  .get("/ping", () => ({ ok: true }))

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
          "/",
          async ({ query }) => {
            const q = query.q?.trim() ?? "";
            if (q) {
              const results = await search(q);
              return new Response(renderPage({ query: q, results }), {
                headers: { "content-type": "text/html" },
              });
            }
            const captures = db
              .query(
                "SELECT id, text, source, captured_at, ingested_at FROM captures ORDER BY ingested_at DESC LIMIT 50"
              )
              .all() as CaptureRow[];
            return new Response(renderPage({ captures }), {
              headers: { "content-type": "text/html" },
            });
          },
          { query: t.Object({ q: t.Optional(t.String()) }) }
        )
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
        .get(
          "/api/search",
          async ({ query, set }) => {
            const q = query.q?.trim() ?? "";
            if (!q) {
              set.status = 400;
              return { error: "q is required" };
            }
            const results = await search(q);
            return { results };
          },
          { query: t.Object({ q: t.Optional(t.String()) }) }
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
          if (!AGENT_TOKEN || !token || !tokenMatches(token, AGENT_TOKEN)) {
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
              writeCaptureFile(row.id, body.text, body.source, body.captured_at);
              refreshIndex();
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

  .listen({ port: 3000, hostname: process.env.HOST ?? "127.0.0.1" });

console.log(`Spine listening on http://127.0.0.1:${app.server?.port}`);
