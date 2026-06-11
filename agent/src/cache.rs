use anyhow::{Context, Result};
use rusqlite::{Connection, params};
use std::fs;
use std::path::PathBuf;
use std::sync::{Arc, Mutex};
use tracing::warn;

/// Outcome of the last processing attempt for a cached file.
#[derive(Clone, Copy, Debug, PartialEq, Eq)]
pub enum Outcome {
    /// The file's text was extracted and sent to the spine.
    Indexed,
    /// The file matched a watch pattern but could not be extracted (no
    /// handler and not UTF-8 text); remembered to avoid re-reading and
    /// re-warning every pass.
    Skipped,
}

impl Outcome {
    fn as_str(self) -> &'static str {
        match self {
            Outcome::Indexed => "indexed",
            Outcome::Skipped => "skipped",
        }
    }

    /// Rows only ever contain values written by `as_str`, but a corrupt or
    /// hand-edited row must not wedge the scanner: anything unrecognized is
    /// treated as indexed, which at worst re-processes the file on change.
    fn parse(s: &str) -> Outcome {
        match s {
            "indexed" => Outcome::Indexed,
            "skipped" => Outcome::Skipped,
            other => {
                warn!(outcome = %other, "unknown cache outcome value — treating as indexed");
                Outcome::Indexed
            }
        }
    }
}

#[derive(Clone)]
pub struct Cache(Arc<Mutex<Connection>>);

pub struct FileState {
    pub mtime_secs: i64,
    pub size_bytes: i64,
    pub hash: String,
    pub outcome: Outcome,
    pub extractor_gen: i64,
}

impl Cache {
    pub fn get(&self, path: &str) -> Option<FileState> {
        let conn = self.0.lock().unwrap();
        let row = conn.query_row(
            "SELECT mtime_secs, size_bytes, hash, outcome, extractor_gen
             FROM file_cache WHERE path = ?1",
            params![path],
            |row| {
                Ok(FileState {
                    mtime_secs: row.get(0)?,
                    size_bytes: row.get(1)?,
                    hash: row.get(2)?,
                    outcome: Outcome::parse(&row.get::<_, String>(3)?),
                    extractor_gen: row.get(4)?,
                })
            },
        );
        match row {
            Ok(state) => Some(state),
            Err(rusqlite::Error::QueryReturnedNoRows) => None,
            Err(e) => {
                warn!(path, error = %e, "cache read failed — treating file as uncached");
                None
            }
        }
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
            Outcome::Indexed,
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
            Outcome::Skipped,
            extractor_gen,
        );
    }

    /// Refresh a row's metadata (mtime/size/last_sent_at) for a file whose
    /// content is unchanged, preserving its outcome and extractor generation.
    pub fn refresh(&self, path: &str, mtime_secs: i64, size_bytes: i64, cached: &FileState) {
        self.write(
            path,
            mtime_secs,
            size_bytes,
            &cached.hash,
            cached.outcome,
            cached.extractor_gen,
        );
    }

    fn write(
        &self,
        path: &str,
        mtime_secs: i64,
        size_bytes: i64,
        hash: &str,
        outcome: Outcome,
        extractor_gen: i64,
    ) {
        let conn = self.0.lock().unwrap();
        let result = conn.execute(
            "INSERT INTO file_cache (path, mtime_secs, size_bytes, hash, last_sent_at, outcome, extractor_gen)
             VALUES (?1, ?2, ?3, ?4, datetime('now'), ?5, ?6)
             ON CONFLICT(path) DO UPDATE SET
               mtime_secs    = excluded.mtime_secs,
               size_bytes    = excluded.size_bytes,
               hash          = excluded.hash,
               last_sent_at  = excluded.last_sent_at,
               outcome       = excluded.outcome,
               extractor_gen = excluded.extractor_gen",
            params![path, mtime_secs, size_bytes, hash, outcome.as_str(), extractor_gen],
        );
        if let Err(e) = result {
            warn!(path, error = %e, "cache write failed — file will be re-processed next pass");
        }
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
        let result = conn.execute(
            "INSERT OR IGNORE INTO watch_paths (path, first_seen_at) VALUES (?1, datetime('now'))",
            params![path],
        );
        if let Err(e) = result {
            warn!(path, error = %e, "failed to record watch path — full index will repeat next pass");
        }
    }

    pub fn clear_known_paths(&self) {
        let conn = self.0.lock().unwrap();
        if let Err(e) = conn.execute("DELETE FROM watch_paths", []) {
            warn!(error = %e, "failed to clear known watch paths");
        }
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
    // The defaults are correct for pre-existing rows (all were indexed).
    add_column(
        &conn,
        "ALTER TABLE file_cache ADD COLUMN outcome TEXT NOT NULL DEFAULT 'indexed';",
    )?;
    add_column(
        &conn,
        "ALTER TABLE file_cache ADD COLUMN extractor_gen INTEGER NOT NULL DEFAULT 0;",
    )?;

    Ok(Cache(Arc::new(Mutex::new(conn))))
}

/// Apply an additive ALTER TABLE, tolerating only "duplicate column name"
/// (the column already exists on an up-to-date database). Any other failure
/// propagates: a half-migrated schema would otherwise make every cache read
/// fail and silently re-process every watched file on every pass.
fn add_column(conn: &Connection, sql: &str) -> Result<()> {
    match conn.execute_batch(sql) {
        Ok(()) => Ok(()),
        Err(e) if e.to_string().contains("duplicate column name") => Ok(()),
        Err(e) => Err(e).context("cache schema migration failed"),
    }
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
        assert_eq!(state.outcome, Outcome::Indexed);
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
        assert_eq!(state.outcome, Outcome::Skipped);
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
        assert_eq!(state.outcome, Outcome::Indexed);
        assert_eq!(state.extractor_gen, 2);
        assert_eq!(state.hash, "h2");
    }

    #[test]
    fn refresh_preserves_outcome_and_generation() {
        let cache = open_in_memory();
        cache.upsert_skipped("/f", 1, 2, "h", 1);
        let cached = cache.get("/f").unwrap();
        cache.refresh("/f", 99, 100, &cached);
        let state = cache.get("/f").unwrap();
        assert_eq!(state.outcome, Outcome::Skipped);
        assert_eq!(state.extractor_gen, 1);
        assert_eq!(state.hash, "h");
        assert_eq!(state.mtime_secs, 99);
        assert_eq!(state.size_bytes, 100);
    }

    #[test]
    fn unknown_outcome_value_reads_as_indexed() {
        let cache = open_in_memory();
        cache
            .0
            .lock()
            .unwrap()
            .execute(
                "INSERT INTO file_cache (path, mtime_secs, size_bytes, hash, last_sent_at, outcome, extractor_gen)
                 VALUES ('/weird', 1, 2, 'h', datetime('now'), 'corrupted', 1)",
                [],
            )
            .unwrap();
        let state = cache.get("/weird").unwrap();
        assert_eq!(state.outcome, Outcome::Indexed);
    }
}
