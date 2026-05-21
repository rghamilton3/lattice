import { Elysia, t } from "elysia";
import type { Database } from "bun:sqlite";
import type { CaptureRow } from "../db/rows";

export const capturesRoutes = (db: Database) =>
  new Elysia()
    .get(
      "/api/captures",
      ({ query }) => {
        const raw = query.limit ? Number(query.limit) : 50;
        const limit = Math.min(Number.isFinite(raw) && raw > 0 ? raw : 50, 200);
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
    );
