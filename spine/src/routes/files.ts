import { Elysia, t } from "elysia";
import type { Database } from "bun:sqlite";
import { realpath } from "node:fs/promises";

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

export const filesRoutes = (db: Database) =>
  new Elysia()
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
    );
