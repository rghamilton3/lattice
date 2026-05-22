CREATE TABLE agent_status (
  machine_id     TEXT PRIMARY KEY,
  state          TEXT NOT NULL,
  last_scan_at   TEXT,
  last_indexed   INTEGER NOT NULL DEFAULT 0,
  last_skipped   INTEGER NOT NULL DEFAULT 0,
  last_errors    INTEGER NOT NULL DEFAULT 0,
  spine_ok       INTEGER NOT NULL DEFAULT 1,
  last_error_msg TEXT,
  reported_at    TEXT NOT NULL
);
