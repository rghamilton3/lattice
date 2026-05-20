CREATE TABLE captures (
  id          INTEGER PRIMARY KEY AUTOINCREMENT,
  text        TEXT    NOT NULL,
  source      TEXT    NOT NULL,
  captured_at TEXT    NOT NULL,
  ingested_at TEXT    NOT NULL
);
