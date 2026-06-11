use anyhow::{Context, Result};
use rusqlite::{Connection, params};
use std::fs;
use std::path::PathBuf;
use std::sync::{Arc, Mutex};

/// Cache row outcome: the file's text was extracted and sent to the spine.
pub const OUTCOME_INDEXED: &str = "indexed";
/// Cache row outcome: the file matched a watch pattern but could not be
/// extracted (no handler and not UTF-8 text); remembered to avoid re-reading
/// and re-warning every pass.
pub const OUTCOME_SKIPPED: &str = "skipped";

#[derive(Clone)]
pub struct Cache(Arc<Mutex<Connection>>);

pub struct FileState {
    pub mtime_secs: i64,
    pub size_bytes: i64,
    pub hash: String,
    pub outcome: String,
    pub extractor_gen: i64,
}

impl Cache {
    pub fn get(&self, path: &str) -> Option<FileState> {
        let conn = self.0.lock().unwrap();
        conn.query_row(
            "SELECT mtime_secs, size_bytes, hash, outcome, extractor_gen
             FROM file_cache WHERE path = ?1",
            params![path],
            |row| {
                Ok(FileState {
                    mtime_secs: row.get(0)?,
                    size_bytes: row.get(1)?,
                    hash: row.get(2)?,
                    outcome: row.get(3)?,
                    extractor_gen: row.get(4)?,
                })
            },
        )
        .ok()
    }

    pub fn upsert(
        &self,
        path: &str,
        mtime_secs: i64,
        size_bytes: i64,
        hash: &str,
        extractor_gen: i64,
    ) {
        self.write(
            path,
            mtime_secs,
            size_bytes,
            hash,
            OUTCOME_INDEXED,
            extractor_gen,
        );
    }

    pub fn upsert_skipped(
        &self,
        path: &str,
        mtime_secs: i64,
        size_bytes: i64,
        hash: &str,
        extractor_gen: i64,
    ) {
        self.write(
            path,
            mtime_secs,
            size_bytes,
            hash,
            OUTCOME_SKIPPED,
            extractor_gen,
        );
    }

    fn write(
        &self,
        path: &str,
        mtime_secs: i64,
        size_bytes: i64,
        hash: &str,
        outcome: &str,
        extractor_gen: i64,
    ) {
        let conn = self.0.lock().unwrap();
        conn.execute(
            "INSERT INTO file_cache (path, mtime_secs, size_bytes, hash, last_sent_at, outcome, extractor_gen)
             VALUES (?1, ?2, ?3, ?4, datetime('now'), ?5, ?6)
             ON CONFLICT(path) DO UPDATE SET
               mtime_secs    = excluded.mtime_secs,
               size_bytes    = excluded.size_bytes,
               hash          = excluded.hash,
               last_sent_at  = excluded.last_sent_at,
               outcome       = excluded.outcome,
               extractor_gen = excluded.extractor_gen",
            params![path, mtime_secs, size_bytes, hash, outcome, extractor_gen],
        )
        .ok();
    }

    pub fn is_known_path(&self, path: &str) -> bool {
        let conn = self.0.lock().unwrap();
        conn.query_row(
            "SELECT 1 FROM watch_paths WHERE path = ?1",
            params![path],
            |_| Ok(()),
        )
        .is_ok()
    }

    pub fn record_path(&self, path: &str) {
        let conn = self.0.lock().unwrap();
        conn.execute(
            "INSERT OR IGNORE INTO watch_paths (path, first_seen_at) VALUES (?1, datetime('now'))",
            params![path],
        )
        .ok();
    }

    pub fn clear_known_paths(&self) {
        let conn = self.0.lock().unwrap();
        conn.execute("DELETE FROM watch_paths", []).ok();
    }
}

pub fn open() -> Result<Cache> {
    let path = cache_db_path();
    if let Some(parent) = path.parent() {
        fs::create_dir_all(parent)
            .with_context(|| format!("cannot create cache dir {}", parent.display()))?;
    }
    let conn = Connection::open(&path)
        .with_context(|| format!("cannot open cache db at {}", path.display()))?;
    init(conn)
}

fn init(conn: Connection) -> Result<Cache> {
    conn.execute_batch(
        "PRAGMA journal_mode = WAL;
         PRAGMA synchronous = NORMAL;
         CREATE TABLE IF NOT EXISTS file_cache (
           path          TEXT PRIMARY KEY,
           mtime_secs    INTEGER NOT NULL,
           size_bytes    INTEGER NOT NULL,
           hash          TEXT NOT NULL,
           last_sent_at  TEXT NOT NULL,
           outcome       TEXT NOT NULL DEFAULT 'indexed',
           extractor_gen INTEGER NOT NULL DEFAULT 0
         );
         CREATE TABLE IF NOT EXISTS watch_paths (
           path         TEXT PRIMARY KEY,
           first_seen_at TEXT NOT NULL
         );",
    )
    .context("cache schema init failed")?;

    // Additive migrations for databases created before outcome tracking.
    // "duplicate column name" on up-to-date databases is expected; the
    // defaults are correct for pre-existing rows (all were indexed).
    let _ = conn.execute_batch(
        "ALTER TABLE file_cache ADD COLUMN outcome TEXT NOT NULL DEFAULT 'indexed';",
    );
    let _ = conn.execute_batch(
        "ALTER TABLE file_cache ADD COLUMN extractor_gen INTEGER NOT NULL DEFAULT 0;",
    );

    Ok(Cache(Arc::new(Mutex::new(conn))))
}

fn cache_db_path() -> PathBuf {
    lattice_agent::platform::data_dir().join("agent.db")
}

#[cfg(test)]
mod tests {
    use super::*;

    fn open_in_memory() -> Cache {
        init(Connection::open_in_memory().unwrap()).unwrap()
    }

    /// Simulates a database created before the outcome columns existed.
    fn open_with_legacy_schema() -> Cache {
        let conn = Connection::open_in_memory().unwrap();
        conn.execute_batch(
            "CREATE TABLE file_cache (
               path         TEXT PRIMARY KEY,
               mtime_secs   INTEGER NOT NULL,
               size_bytes   INTEGER NOT NULL,
               hash         TEXT NOT NULL,
               last_sent_at TEXT NOT NULL
             );
             INSERT INTO file_cache VALUES ('/old/file.md', 100, 42, 'abc', datetime('now'));",
        )
        .unwrap();
        init(conn).unwrap()
    }

    #[test]
    fn migration_backfills_legacy_rows_as_indexed_gen_zero() {
        let cache = open_with_legacy_schema();
        let state = cache.get("/old/file.md").expect("legacy row survives");
        assert_eq!(state.outcome, OUTCOME_INDEXED);
        assert_eq!(state.extractor_gen, 0);
        assert_eq!(state.hash, "abc");
    }

    #[test]
    fn migration_is_idempotent_on_current_schema() {
        // init() runs CREATE TABLE with the new columns and then the ALTERs;
        // the duplicate-column errors must be swallowed.
        let cache = open_in_memory();
        cache.upsert("/a", 1, 2, "h1", 1);
        assert!(cache.get("/a").is_some());
    }

    #[test]
    fn skipped_rows_round_trip() {
        let cache = open_in_memory();
        cache.upsert_skipped("/bin/blob.zip", 10, 20, "h2", 1);
        let state = cache.get("/bin/blob.zip").unwrap();
        assert_eq!(state.outcome, OUTCOME_SKIPPED);
        assert_eq!(state.extractor_gen, 1);
        assert_eq!(state.mtime_secs, 10);
        assert_eq!(state.size_bytes, 20);
    }

    #[test]
    fn upsert_overwrites_skipped_with_indexed() {
        let cache = open_in_memory();
        cache.upsert_skipped("/f", 1, 2, "h", 1);
        cache.upsert("/f", 3, 4, "h2", 2);
        let state = cache.get("/f").unwrap();
        assert_eq!(state.outcome, OUTCOME_INDEXED);
        assert_eq!(state.extractor_gen, 2);
        assert_eq!(state.hash, "h2");
    }
}
