import { describe, expect, it, afterEach } from "bun:test";
import { mkTestEnv, type TestEnv } from "../helpers/env";

let env: TestEnv | null = null;

afterEach(() => {
  env?.cleanup();
  env = null;
});

describe("db.initDb", () => {
  it("creates schema_migrations and applies all migrations on first run", async () => {
    env = mkTestEnv();
    const { initDb } = await import("../../src/db");
    const db = initDb();

    const tables = db
      .query("SELECT name FROM sqlite_master WHERE type='table' ORDER BY name")
      .all() as { name: string }[];
    const names = tables.map((t) => t.name);
    expect(names).toContain("schema_migrations");
    expect(names).toContain("captures");
    expect(names).toContain("file_index");
    expect(names).toContain("capture_attachments");

    const migrations = db
      .query("SELECT name FROM schema_migrations ORDER BY name")
      .all() as { name: string }[];
    expect(migrations.map((m) => m.name)).toEqual([
      "001_captures.sql",
      "002_file_index.sql",
      "003_capture_attachments.sql",
      "004_capture_triage.sql",
    ]);
    db.close();
  });

  it("is idempotent — re-running initDb does not re-apply migrations", async () => {
    env = mkTestEnv();
    const { initDb } = await import("../../src/db");
    const db1 = initDb();
    const first = db1
      .query("SELECT applied_at FROM schema_migrations WHERE name = ?")
      .get("001_captures.sql") as { applied_at: string };
    db1.close();

    // Re-init on the same file.
    const db2 = initDb();
    const second = db2
      .query("SELECT applied_at FROM schema_migrations WHERE name = ?")
      .get("001_captures.sql") as { applied_at: string };
    expect(second.applied_at).toBe(first.applied_at);
    db2.close();
  });

  it("enables WAL journal mode and foreign keys", async () => {
    env = mkTestEnv();
    const { initDb } = await import("../../src/db");
    const db = initDb();
    const journal = db.query("PRAGMA journal_mode").get() as { journal_mode: string };
    expect(journal.journal_mode.toLowerCase()).toBe("wal");
    const fk = db.query("PRAGMA foreign_keys").get() as { foreign_keys: number };
    expect(fk.foreign_keys).toBe(1);
    db.close();
  });

  it("getDb throws when initDb has not run in this process", async () => {
    const { getDb, __resetDbForTests } = await import("../../src/db");
    __resetDbForTests();
    expect(() => getDb()).toThrow(/DB not initialized/);
  });
});

describe("db migration table schemas", () => {
  it("captures has the expected columns", async () => {
    env = mkTestEnv();
    const { initDb } = await import("../../src/db");
    const db = initDb();
    const cols = db.query("PRAGMA table_info(captures)").all() as {
      name: string;
      notnull: number;
    }[];
    const names = cols.map((c) => c.name).sort();
    expect(names).toEqual(["captured_at", "id", "ingested_at", "source", "text", "triage_action", "triaged_at"]);
    db.close();
  });

  it("file_index enforces UNIQUE(machine_id, path)", async () => {
    env = mkTestEnv();
    const { initDb } = await import("../../src/db");
    const db = initDb();
    db.run(
      `INSERT INTO file_index
         (machine_id, path, hash, mime_type, text, modified_at, size_bytes, indexed_at)
       VALUES ('m1', '/a', 'h1', 'text/plain', 't', '2026-01-01', 1, '2026-01-01')`
    );
    expect(() =>
      db.run(
        `INSERT INTO file_index
           (machine_id, path, hash, mime_type, text, modified_at, size_bytes, indexed_at)
         VALUES ('m1', '/a', 'h2', 'text/plain', 't', '2026-01-01', 1, '2026-01-01')`
      )
    ).toThrow();
    db.close();
  });

  it("capture_attachments references captures with foreign key", async () => {
    env = mkTestEnv();
    const { initDb } = await import("../../src/db");
    const db = initDb();
    // FK violation when referenced capture doesn't exist.
    expect(() =>
      db.run(
        `INSERT INTO capture_attachments
           (capture_id, signal_id, content_type, filename, size_bytes, stored_path, created_at)
         VALUES (9999, 'sig1', 'audio/aac', 'f.aac', 100, '9999/f.aac', '2026-01-01')`
      )
    ).toThrow();
    db.close();
  });
});
