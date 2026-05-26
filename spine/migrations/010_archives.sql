CREATE TABLE archives (
  id             INTEGER PRIMARY KEY AUTOINCREMENT,
  url            TEXT    NOT NULL,
  title          TEXT,
  archived_at    TEXT    NOT NULL,
  captured_via   TEXT    NOT NULL CHECK (captured_via IN ('singlefile', 'monolith')),
  hash           TEXT    NOT NULL,
  archive_path   TEXT    NOT NULL,
  extracted_text TEXT    NOT NULL DEFAULT '',
  source         TEXT,
  why_saved      TEXT,
  quality        TEXT    NOT NULL CHECK (quality IN ('good', 'degraded', 'failed')),
  supersedes     INTEGER REFERENCES archives(id),
  superseded_by  INTEGER REFERENCES archives(id),
  reviewed_at    TEXT,
  review_action  TEXT,
  deleted_at     TEXT
);

CREATE INDEX idx_archives_url_current ON archives(url, superseded_by, deleted_at);
CREATE INDEX idx_archives_review ON archives(quality, reviewed_at, deleted_at, archived_at);
CREATE INDEX idx_archives_hash ON archives(hash);
