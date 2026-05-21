use anyhow::{Context, Result};
use rusqlite::{Connection, params};
use std::fs;
use std::path::PathBuf;
use std::sync::{Arc, Mutex};

#[derive(Clone)]
pub struct Cache(Arc<Mutex<Connection>>);

pub struct FileState {
    pub mtime_secs: i64,
    pub size_bytes: i64,
    pub hash: String,
}

impl Cache {
    pub fn get(&self, path: &str) -> Option<FileState> {
        let conn = self.0.lock().unwrap();
        conn.query_row(
            "SELECT mtime_secs, size_bytes, hash FROM file_cache WHERE path = ?1",
            params![path],
            |row| {
                Ok(FileState {
                    mtime_secs: row.get(0)?,
                    size_bytes: row.get(1)?,
                    hash: row.get(2)?,
                })
            },
        )
        .ok()
    }

    pub fn upsert(&self, path: &str, mtime_secs: i64, size_bytes: i64, hash: &str) {
        let conn = self.0.lock().unwrap();
        conn.execute(
            "INSERT INTO file_cache (path, mtime_secs, size_bytes, hash, last_sent_at)
             VALUES (?1, ?2, ?3, ?4, datetime('now'))
             ON CONFLICT(path) DO UPDATE SET
               mtime_secs   = excluded.mtime_secs,
               size_bytes   = excluded.size_bytes,
               hash         = excluded.hash,
               last_sent_at = excluded.last_sent_at",
            params![path, mtime_secs, size_bytes, hash],
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
    conn.execute_batch(
        "PRAGMA journal_mode = WAL;
         PRAGMA synchronous = NORMAL;
         CREATE TABLE IF NOT EXISTS file_cache (
           path         TEXT PRIMARY KEY,
           mtime_secs   INTEGER NOT NULL,
           size_bytes   INTEGER NOT NULL,
           hash         TEXT NOT NULL,
           last_sent_at TEXT NOT NULL
         );
         CREATE TABLE IF NOT EXISTS watch_paths (
           path         TEXT PRIMARY KEY,
           first_seen_at TEXT NOT NULL
         );",
    )
    .context("cache schema init failed")?;
    Ok(Cache(Arc::new(Mutex::new(conn))))
}

fn cache_db_path() -> PathBuf {
    // XDG_DATA_HOME or ~/.local/share
    let base = if let Ok(v) = std::env::var("XDG_DATA_HOME") {
        PathBuf::from(v)
    } else {
        let home = std::env::var("HOME").unwrap_or_else(|_| "/root".to_owned());
        PathBuf::from(home).join(".local").join("share")
    };
    base.join("lattice").join("agent.db")
}
