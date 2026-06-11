CREATE TABLE IF NOT EXISTS track_bins (
  id              INTEGER PRIMARY KEY AUTOINCREMENT,
  name            TEXT NOT NULL,
  normalized_name TEXT NOT NULL,
  created_at      TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at      TEXT NOT NULL DEFAULT (datetime('now')),
  archived_at     TEXT
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_track_bins_active_normalized
  ON track_bins(normalized_name)
  WHERE archived_at IS NULL;

CREATE TABLE IF NOT EXISTS track_photos (
  ref          TEXT PRIMARY KEY NOT NULL,
  filename     TEXT NOT NULL,
  content_type TEXT NOT NULL,
  size_bytes   INTEGER NOT NULL,
  stored_path  TEXT NOT NULL,
  created_at   TEXT NOT NULL DEFAULT (datetime('now'))
);
