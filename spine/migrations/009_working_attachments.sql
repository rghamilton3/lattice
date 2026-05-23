CREATE TABLE working_attachments (
  id           INTEGER PRIMARY KEY AUTOINCREMENT,
  slug         TEXT    NOT NULL,
  content_type TEXT    NOT NULL,
  filename     TEXT    NOT NULL DEFAULT '',
  size_bytes   INTEGER NOT NULL,
  stored_path  TEXT    NOT NULL,
  created_at   TEXT    NOT NULL
);
CREATE INDEX idx_working_attachments_slug ON working_attachments(slug);
