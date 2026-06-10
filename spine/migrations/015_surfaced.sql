CREATE TABLE surfaced (
  id           INTEGER PRIMARY KEY AUTOINCREMENT,
  target_kind  TEXT NOT NULL,
  target_id    TEXT NOT NULL,
  surfaced_at  TEXT NOT NULL,
  reason       TEXT,
  dismissed_at TEXT
);
CREATE INDEX idx_surfaced_date      ON surfaced(surfaced_at);
CREATE INDEX idx_surfaced_dismissed ON surfaced(dismissed_at);
