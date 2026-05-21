import { Elysia, t } from "elysia";
import { staticPlugin } from "@elysiajs/static";
import { timingSafeEqual } from "node:crypto";
import { realpath } from "node:fs/promises";
import { join } from "node:path";
import { existsSync } from "node:fs";
import { initDb } from "./db";
import {
  initSearch,
  writeCaptureFile,
  writeLocalFile,
  refreshIndex,
  search,
} from "./search";
import type { SearchResult } from "./search";
import { getAgentToken } from "./config";
import {
  WorkingNotFoundError,
  WorkingConflictError,
  listWorking,
  readWorking,
  createWorking,
  updateWorking,
  deleteWorking,
} from "./working";

const db = initDb();
await initSearch(db);

const AGENT_TOKEN = getAgentToken();
const ALLOW_HTTP = process.env.ALLOW_HTTP === "true";
const DEV_USER = process.env.DEV_USER;
const SURFACE_BUILD =
  process.env.SURFACE_BUILD ?? join(import.meta.dir, "../../surface/build");

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

interface FileRow {
  id: number;
  machine_id: string;
  path: string;
  hash: string;
  mime_type: string;
  text: string;
  modified_at: string;
  size_bytes: number;
  indexed_at: string;
}

const app = new Elysia()
  .get("/ping", () => ({ ok: true }))
  .use(
    existsSync(SURFACE_BUILD)
      ? staticPlugin({ assets: SURFACE_BUILD, prefix: "", indexHTML: true, alwaysStatic: false })
      : new Elysia()
  )

  .guard(
    {
      beforeHandle({ headers, set }) {
        if (!ALLOW_HTTP && headers["x-forwarded-proto"] !== "https") {
          set.status = 400;
          return "HTTPS required";
        }
        if (DEV_USER) {
          headers["x-authentik-username"] = DEV_USER;
        } else if (!headers["x-authentik-username"]) {
          set.status = 401;
          return "Unauthorized";
        }
      },
    },
    (app) =>
      app
        // ── Captures ──────────────────────────────────────────────────────
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
          "/api/captures/:id",
          ({ params, set }) => {
            const id = parseInt(params.id, 10);
            if (isNaN(id)) {
              set.status = 400;
              return { error: "Invalid id" };
            }
            const row = db
              .query(
                "SELECT id, text, source, captured_at, ingested_at FROM captures WHERE id = ?"
              )
              .get(id) as CaptureRow | null;
            if (!row) {
              set.status = 404;
              return { error: "Not found" };
            }
            return row;
          },
          { params: t.Object({ id: t.String() }) }
        )

        // ── Search ────────────────────────────────────────────────────────
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

        // ── File index ────────────────────────────────────────────────────
        .get(
          "/api/files/:id",
          ({ params, set }) => {
            const id = parseInt(params.id, 10);
            if (isNaN(id)) {
              set.status = 400;
              return { error: "Invalid id" };
            }
            const row = db
              .query("SELECT * FROM file_index WHERE id = ?")
              .get(id) as FileRow | null;
            if (!row) {
              set.status = 404;
              return { error: "Not found" };
            }
            return row;
          },
          { params: t.Object({ id: t.String() }) }
        )
        .get(
          "/api/files/:id/raw",
          async ({ params, set }) => {
            const id = parseInt(params.id, 10);
            if (isNaN(id)) {
              set.status = 400;
              return "Invalid id";
            }
            const row = db
              .query("SELECT path, mime_type FROM file_index WHERE id = ?")
              .get(id) as Pick<FileRow, "path" | "mime_type"> | null;
            if (!row) {
              set.status = 404;
              return "Not found";
            }
            // Symlink-swap defense: stored path must equal its canonical form
            let resolved: string;
            try {
              resolved = await realpath(row.path);
            } catch {
              set.status = 404;
              return "File not found on disk";
            }
            if (resolved !== row.path) {
              set.status = 403;
              return "Forbidden";
            }
            return new Response(Bun.file(resolved), {
              headers: { "Content-Type": row.mime_type },
            });
          },
          { params: t.Object({ id: t.String() }) }
        )

        // ── Working docs ──────────────────────────────────────────────────
        .get("/api/working", ({ set }) => {
          try {
            return listWorking();
          } catch (e) {
            set.status = 500;
            return { error: "Failed to list working docs" };
          }
        })
        .get(
          "/api/working/:slug",
          ({ params, set }) => {
            try {
              return readWorking(params.slug);
            } catch (e) {
              if (e instanceof WorkingNotFoundError) {
                set.status = 404;
                return { error: "Not found" };
              }
              throw e;
            }
          },
          { params: t.Object({ slug: t.String({ pattern: "^[a-z0-9-]+$" }) }) }
        )
        .post(
          "/api/working",
          async ({ body, set }) => {
            let content = body.content;

            if (body.seed_capture_id != null) {
              const row = db
                .query("SELECT text, captured_at FROM captures WHERE id = ?")
                .get(body.seed_capture_id) as Pick<
                CaptureRow,
                "text" | "captured_at"
              > | null;
              if (!row) {
                set.status = 404;
                return { error: "Capture not found" };
              }
              content = `# ${body.title}\n\n> Seeded from capture #${body.seed_capture_id} (${row.captured_at})\n\n${row.text}\n`;
            } else if (body.seed_file_id != null) {
              const row = db
                .query("SELECT text, path FROM file_index WHERE id = ?")
                .get(body.seed_file_id) as Pick<FileRow, "text" | "path"> | null;
              if (!row) {
                set.status = 404;
                return { error: "File not found" };
              }
              content = `# ${body.title}\n\n> Seeded from file: ${row.path}\n\n${row.text}\n`;
            }

            try {
              const slug = createWorking(body.title, content);
              refreshIndex();
              return { slug };
            } catch (e) {
              if (e instanceof WorkingConflictError) {
                set.status = 409;
                return { error: "Slug already exists" };
              }
              throw e;
            }
          },
          {
            body: t.Object({
              title: t.String({ minLength: 1 }),
              content: t.Optional(t.String()),
              seed_capture_id: t.Optional(t.Integer()),
              seed_file_id: t.Optional(t.Integer()),
            }),
          }
        )
        .put(
          "/api/working/:slug",
          ({ params, body, set }) => {
            try {
              updateWorking(params.slug, body.content);
              refreshIndex();
              return { ok: true };
            } catch (e) {
              if (e instanceof WorkingNotFoundError) {
                set.status = 404;
                return { error: "Not found" };
              }
              throw e;
            }
          },
          {
            params: t.Object({ slug: t.String({ pattern: "^[a-z0-9-]+$" }) }),
            body: t.Object({ content: t.String() }),
          }
        )
        .delete(
          "/api/working/:slug",
          ({ params, set }) => {
            try {
              deleteWorking(params.slug);
              refreshIndex();
              return { ok: true };
            } catch (e) {
              if (e instanceof WorkingNotFoundError) {
                set.status = 404;
                return { error: "Not found" };
              }
              throw e;
            }
          },
          { params: t.Object({ slug: t.String({ pattern: "^[a-z0-9-]+$" }) }) }
        )

        // ── Lateral movement ──────────────────────────────────────────────
        .get(
          "/api/similar",
          async ({ query, set }) => {
            const { id, kind } = query;
            let sourceText = "";

            if (kind === "capture") {
              const numId = parseInt(id, 10);
              if (isNaN(numId)) {
                set.status = 400;
                return { error: "Invalid id" };
              }
              const row = db
                .query("SELECT text FROM captures WHERE id = ?")
                .get(numId) as { text: string } | null;
              if (!row) {
                set.status = 404;
                return { error: "Not found" };
              }
              sourceText = row.text;
            } else if (kind === "local-file") {
              const numId = parseInt(id, 10);
              if (isNaN(numId)) {
                set.status = 400;
                return { error: "Invalid id" };
              }
              const row = db
                .query("SELECT text FROM file_index WHERE id = ?")
                .get(numId) as { text: string } | null;
              if (!row) {
                set.status = 404;
                return { error: "Not found" };
              }
              sourceText = row.text;
            } else {
              // kind === "working", id is a slug
              try {
                const doc = readWorking(id);
                sourceText = doc.content;
              } catch (e) {
                if (e instanceof WorkingNotFoundError) {
                  set.status = 404;
                  return { error: "Not found" };
                }
                throw e;
              }
            }

            const numId = kind !== "working" ? parseInt(id, 10) : NaN;
            const raw = await search(sourceText.slice(0, 2000));
            const filtered = raw
              .filter((r) => !(r.kind === "capture" && r.id === numId))
              .filter((r) => !(r.kind === "working" && r.slug === id))
              .slice(0, 10);
            return { results: filtered };
          },
          {
            query: t.Object({
              id: t.String({ minLength: 1 }),
              kind: t.Union([
                t.Literal("capture"),
                t.Literal("local-file"),
                t.Literal("working"),
              ]),
            }),
          }
        )
        .get(
          "/api/nearby",
          ({ query, set }) => {
            const ts = query.timestamp?.trim();
            if (!ts) {
              set.status = 400;
              return { error: "timestamp is required" };
            }
            const windowHours = Math.min(
              Math.max(Number(query.window_hours) || 72, 1),
              720
            );
            const base = new Date(ts);
            if (isNaN(base.getTime())) {
              set.status = 400;
              return { error: "Invalid timestamp" };
            }
            const lower = new Date(
              base.getTime() - windowHours * 3_600_000
            ).toISOString();
            const upper = new Date(
              base.getTime() + windowHours * 3_600_000
            ).toISOString();

            const results = db
              .query(
                `SELECT id, 'capture' AS kind, captured_at AS ts,
                        substr(text, 1, 200) AS snippet, NULL AS machine_id
                 FROM captures
                 WHERE captured_at BETWEEN ? AND ?
                 UNION ALL
                 SELECT id, 'local-file' AS kind, modified_at AS ts,
                        substr(text, 1, 200) AS snippet, machine_id
                 FROM file_index
                 WHERE modified_at BETWEEN ? AND ?
                 ORDER BY ts ASC`
              )
              .all(lower, upper, lower, upper);
            return { results };
          },
          {
            query: t.Object({
              timestamp: t.String({ minLength: 1 }),
              window_hours: t.Optional(t.String()),
            }),
          }
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
              const existing = db
                .query("SELECT hash FROM file_index WHERE machine_id = ? AND path = ?")
                .get(body.machine_id, body.path) as { hash: string } | null;
              const prevHash = existing?.hash;
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
              writeLocalFile(body.machine_id, body.path, body.hash, body.text, prevHash);
              refreshIndex();
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

console.log(`Spine listening on http://${app.server?.hostname}:${app.server?.port}`);
