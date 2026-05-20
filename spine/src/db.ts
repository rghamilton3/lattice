import { Database } from "bun:sqlite";
import { readdirSync, readFileSync } from "fs";
import { join } from "path";

let _db: Database | null = null;

export function initDb(): Database {
  const path = process.env.DATABASE_PATH ?? "./lattice.dev.db";
  const db = new Database(path);

  db.run("PRAGMA journal_mode = WAL");
  db.run("PRAGMA synchronous = NORMAL");
  db.run("PRAGMA foreign_keys = ON");

  runMigrations(db);

  _db = db;
  return db;
}

export function getDb(): Database {
  if (!_db) throw new Error("DB not initialized — call initDb() first");
  return _db;
}

function runMigrations(db: Database): void {
  db.run(`
    CREATE TABLE IF NOT EXISTS schema_migrations (
      name       TEXT PRIMARY KEY NOT NULL,
      applied_at TEXT NOT NULL
    )
  `);

  const migrationsDir = join(import.meta.dir, "..", "migrations");
  let files: string[];
  try {
    files = readdirSync(migrationsDir)
      .filter((f) => f.endsWith(".sql"))
      .sort();
  } catch {
    return;
  }

  const applied = new Set<string>(
    (
      db.query("SELECT name FROM schema_migrations").all() as { name: string }[]
    ).map((r) => r.name)
  );

  for (const file of files) {
    if (applied.has(file)) continue;
    const sql = readFileSync(join(migrationsDir, file), "utf-8");
    db.transaction(() => {
      runStatements(db, sql);
      db.run("INSERT INTO schema_migrations (name, applied_at) VALUES (?, ?)", [
        file,
        new Date().toISOString(),
      ]);
    })();
    console.log(`Applied migration: ${file}`);
  }
}

function runStatements(db: Database, sql: string): void {
  // Strip line comments before splitting so inline `--` comments don't confuse the splitter.
  // Migration files must be DDL-only (no string literals containing semicolons).
  sql
    .replace(/--[^\n]*/g, "")
    .split(";")
    .map((s) => s.trim())
    .filter((s) => s.length > 0)
    .forEach((stmt) => db.run(stmt));
}
