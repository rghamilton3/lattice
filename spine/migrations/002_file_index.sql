CREATE TABLE file_index (
  id          INTEGER PRIMARY KEY AUTOINCREMENT,
  machine_id  TEXT    NOT NULL,
  path        TEXT    NOT NULL,
  hash        TEXT    NOT NULL,
  mime_type   TEXT    NOT NULL,
  text        TEXT    NOT NULL,
  modified_at TEXT    NOT NULL,
  size_bytes  INTEGER NOT NULL,
  indexed_at  TEXT    NOT NULL,
  UNIQUE (machine_id, path)
);
