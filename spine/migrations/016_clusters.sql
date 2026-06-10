CREATE TABLE clusters (
  id     INTEGER PRIMARY KEY AUTOINCREMENT,
  run_at TEXT NOT NULL,
  label  TEXT
);

CREATE TABLE cluster_memberships (
  cluster_id  INTEGER NOT NULL REFERENCES clusters(id) ON DELETE CASCADE,
  target_kind TEXT NOT NULL,
  target_id   TEXT NOT NULL,
  PRIMARY KEY (cluster_id, target_kind, target_id)
);

CREATE INDEX idx_cluster_memberships_doc
  ON cluster_memberships(target_kind, target_id);
