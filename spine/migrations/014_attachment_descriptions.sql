CREATE TABLE attachment_descriptions (
  id              INTEGER PRIMARY KEY AUTOINCREMENT,
  attachment_kind TEXT    NOT NULL CHECK (attachment_kind IN ('capture', 'working')),
  attachment_id   INTEGER NOT NULL,
  produced_text   TEXT    NOT NULL,
  final_text      TEXT    NOT NULL,
  confirmed       INTEGER NOT NULL DEFAULT 0,
  model_id        TEXT    NOT NULL,
  supersedes      INTEGER REFERENCES attachment_descriptions(id),
  created_at      TEXT    NOT NULL
);
CREATE INDEX idx_att_desc_attachment ON attachment_descriptions(attachment_kind, attachment_id);
CREATE INDEX idx_att_desc_supersedes ON attachment_descriptions(supersedes)
  WHERE supersedes IS NOT NULL;
