import { Elysia, t } from "elysia";
import type { Database } from "bun:sqlite";
import {
  WorkingNotFoundError,
  WorkingConflictError,
  listWorking,
  readWorking,
  createWorking,
  updateWorking,
  deleteWorking,
} from "../working";
import { refreshIndex } from "../search";
import type { CaptureRow, FileIndexRow } from "../db/rows";

type SeedCaptureRow = Pick<CaptureRow, "text" | "captured_at">;
type SeedFileRow = Pick<FileIndexRow, "text" | "path">;

export const workingRoutes = (db: Database) =>
  new Elysia()
    .get("/api/working", ({ set }) => {
      try {
        return listWorking();
      } catch (e) {
        console.error("[working] listWorking failed:", e);
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
          console.error(`[working] readWorking failed for ${params.slug}:`, e);
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
            .get(body.seed_capture_id) as SeedCaptureRow | null;
          if (!row) {
            set.status = 404;
            return { error: "Capture not found" };
          }
          content = `# ${body.title}\n\n> Seeded from capture #${body.seed_capture_id} (${row.captured_at})\n\n${row.text}\n`;
        } else if (body.seed_file_id != null) {
          const row = db
            .query("SELECT text, path FROM file_index WHERE id = ?")
            .get(body.seed_file_id) as SeedFileRow | null;
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
          console.error("[working] createWorking failed:", e);
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
          console.error(`[working] updateWorking failed for ${params.slug}:`, e);
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
          console.error(`[working] deleteWorking failed for ${params.slug}:`, e);
          throw e;
        }
      },
      { params: t.Object({ slug: t.String({ pattern: "^[a-z0-9-]+$" }) }) }
    );
