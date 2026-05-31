CREATE TABLE IF NOT EXISTS annotations (
  id              TEXT PRIMARY KEY NOT NULL,
  target_kind     TEXT NOT NULL CHECK (target_kind IN ('capture', 'local_file', 'working', 'archive')),
  target_id       TEXT NOT NULL CHECK (length(trim(target_id)) > 0),
  selection_start INTEGER CHECK (selection_start IS NULL OR selection_start >= 0),
  selection_end   INTEGER CHECK (selection_end IS NULL OR selection_end > 0),
  selection_text  TEXT CHECK (selection_text IS NULL OR length(trim(selection_text)) > 0),
  comment         TEXT NOT NULL CHECK (length(trim(comment)) > 0),
  created_at      TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
  updated_at      TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
  CHECK (
    (selection_start IS NULL AND selection_end IS NULL)
    OR (selection_start IS NOT NULL AND selection_end IS NOT NULL AND selection_end > selection_start)
  ),
  CHECK (
    target_kind = 'working'
    OR (target_id NOT GLOB '*[^0-9]*' AND CAST(target_id AS INTEGER) > 0)
  )
);

CREATE INDEX IF NOT EXISTS idx_annotations_target
  ON annotations (target_kind, target_id, created_at);
