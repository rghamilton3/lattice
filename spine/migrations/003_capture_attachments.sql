CREATE TABLE capture_attachments (
  id           INTEGER PRIMARY KEY AUTOINCREMENT,
  capture_id   INTEGER NOT NULL REFERENCES captures(id),
  signal_id    TEXT    NOT NULL DEFAULT '',
  content_type TEXT    NOT NULL,
  filename     TEXT    NOT NULL DEFAULT '',
  size_bytes   INTEGER NOT NULL,
  stored_path  TEXT    NOT NULL,
  created_at   TEXT    NOT NULL
);
