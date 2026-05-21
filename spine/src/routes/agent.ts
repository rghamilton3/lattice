import { Elysia, t } from "elysia";
import type { Database } from "bun:sqlite";
import { mkdirSync, writeFileSync } from "node:fs";
import { basename, join } from "node:path";
import { writeCaptureFile, writeLocalFile, refreshIndex } from "../search";

export interface AgentRoutesOptions {
  attachmentsDir: string;
}

export const agentRoutes = (db: Database, { attachmentsDir }: AgentRoutesOptions) =>
  new Elysia()
    .post(
      "/capture",
      ({ body }) => {
        // Atomic INSERT + markdown write: if writeCaptureFile throws (ENOSPC,
        // EACCES, …) bun:sqlite's transaction wrapper ROLLBACKs the row, so
        // a client retry doesn't leave duplicate DB rows with no on-disk file.
        const row = db.transaction(() => {
          const inserted = db
            .prepare(
              "INSERT INTO captures (text, source, captured_at, ingested_at) VALUES (?, ?, ?, ?) RETURNING id"
            )
            .get(
              body.text,
              body.source,
              body.captured_at,
              new Date().toISOString()
            ) as { id: number };
          writeCaptureFile(inserted.id, body.text, body.source, body.captured_at);
          return inserted;
        })();
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
    .post(
      "/capture/:id/attachments",
      ({ params, body, set }) => {
        const captureId = parseInt(params.id, 10);
        if (isNaN(captureId)) {
          set.status = 400;
          return { error: "invalid capture id" };
        }
        const capture = db.query("SELECT id FROM captures WHERE id = ?").get(captureId);
        if (!capture) {
          set.status = 404;
          return { error: "capture not found" };
        }
        // basename(".") === "." and basename("..") === "..", so a plain
        // round-trip check is not enough — reject the dot-dirs explicitly.
        // Require the id to already be a bare filename so the storedName
        // round-trips and a retry-with-same-id is deterministic.
        const sid = body.signal_id;
        if (sid === "." || sid === ".." || basename(sid) !== sid) {
          set.status = 400;
          return { error: "invalid signal_id" };
        }
        const bytes = Buffer.from(body.data, "base64");
        if (bytes.length !== body.size_bytes) {
          set.status = 400;
          return { error: "size_bytes does not match decoded data length" };
        }
        const dir = join(attachmentsDir, String(captureId));
        mkdirSync(dir, { recursive: true });
        writeFileSync(join(dir, sid), bytes);
        const storedPath = `${captureId}/${sid}`;
        const row = db
          .prepare(
            `INSERT INTO capture_attachments
               (capture_id, signal_id, content_type, filename, size_bytes, stored_path, created_at)
             VALUES (?, ?, ?, ?, ?, ?, ?) RETURNING id`
          )
          .get(
            captureId,
            sid,
            body.content_type,
            body.filename,
            body.size_bytes,
            storedPath,
            new Date().toISOString()
          ) as { id: number };
        return { id: row.id };
      },
      {
        params: t.Object({ id: t.String() }),
        body: t.Object({
          content_type: t.String({ minLength: 1 }),
          signal_id: t.String({ minLength: 1 }),
          filename: t.String(),
          data: t.String({ minLength: 1 }),
          size_bytes: t.Integer({ minimum: 0 }),
        }),
      }
    );
