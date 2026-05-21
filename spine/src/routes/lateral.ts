import { Elysia, t } from "elysia";
import type { Database } from "bun:sqlite";
import { search } from "../search";
import { WorkingNotFoundError, readWorking } from "../working";

type LateralSourceKind = "capture" | "local-file" | "working";

type LateralSource =
  | { kind: "capture"; id: number }
  | { kind: "local-file"; id: number }
  | { kind: "working"; slug: string };

function parseLateralSource(
  kind: LateralSourceKind,
  raw: string
): LateralSource | { error: string } {
  if (kind === "working") return { kind, slug: raw };
  const id = parseInt(raw, 10);
  if (isNaN(id)) return { error: "Invalid id" };
  return { kind, id };
}

export const lateralRoutes = (db: Database) =>
  new Elysia()
    .get(
      "/api/similar",
      async ({ query, set }) => {
        const source = parseLateralSource(query.kind, query.id);
        if ("error" in source) {
          set.status = 400;
          return { error: source.error };
        }

        let sourceText: string;
        switch (source.kind) {
          case "capture": {
            const row = db
              .query("SELECT text FROM captures WHERE id = ?")
              .get(source.id) as { text: string } | null;
            if (!row) {
              set.status = 404;
              return { error: "Not found" };
            }
            sourceText = row.text;
            break;
          }
          case "local-file": {
            const row = db
              .query("SELECT text FROM file_index WHERE id = ?")
              .get(source.id) as { text: string } | null;
            if (!row) {
              set.status = 404;
              return { error: "Not found" };
            }
            sourceText = row.text;
            break;
          }
          case "working": {
            try {
              sourceText = readWorking(source.slug).content;
            } catch (e) {
              if (e instanceof WorkingNotFoundError) {
                set.status = 404;
                return { error: "Not found" };
              }
              throw e;
            }
            break;
          }
        }

        const raw = await search(sourceText.slice(0, 2000));
        const filtered = raw
          .filter((r) => {
            if (source.kind === "capture" && r.kind === "capture" && r.id === source.id) return false;
            if (source.kind === "working" && r.kind === "working" && r.slug === source.slug) return false;
            return true;
          })
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
        // Treat "abc"/missing/"0" as default 72; let the clamp handle negatives
        // so window_hours=-5 still maps to the 1h floor (matches prior behavior).
        const parsed = Number(query.window_hours);
        const rawWindow = Number.isFinite(parsed) && parsed !== 0 ? parsed : 72;
        const windowHours = Math.min(Math.max(rawWindow, 1), 720);
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
