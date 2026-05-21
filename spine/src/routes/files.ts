import { Elysia, t } from "elysia";
import type { Database } from "bun:sqlite";
import { realpath } from "node:fs/promises";
import type { FileIndexRow } from "../db/rows";

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
          .get(id) as FileIndexRow | null;
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
          .get(id) as Pick<FileIndexRow, "path" | "mime_type"> | null;
        if (!row) {
          set.status = 404;
          return "Not found";
        }
        // Symlink-swap defense: stored path must equal its canonical form.
        // Discriminate realpath errors — collapsing ELOOP into 404 conflates
        // legitimate "not found" with the symlink-attack signal we're guarding.
        let resolved: string;
        try {
          resolved = await realpath(row.path);
        } catch (e) {
          const code = (e as NodeJS.ErrnoException).code;
          if (code === "ENOENT") {
            set.status = 404;
            return "File not found on disk";
          }
          if (code === "ELOOP") {
            console.warn(`[files] ELOOP resolving ${row.path}`);
            set.status = 403;
            return "Forbidden";
          }
          console.error(`[files] realpath failed (${code ?? "unknown"}) for ${row.path}:`, e);
          set.status = 500;
          return "Internal error";
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
