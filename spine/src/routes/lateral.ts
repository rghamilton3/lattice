import { Elysia, t } from "elysia";
import type { Database } from "bun:sqlite";
import { search } from "../search";
import { WorkingNotFoundError, readWorking } from "../working";

export const lateralRoutes = (db: Database) =>
  new Elysia()
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
    );
