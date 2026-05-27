CREATE TABLE tracks (
  id          INTEGER PRIMARY KEY AUTOINCREMENT,
  text        TEXT    NOT NULL CHECK (length(trim(text)) > 0),
  captured_at TEXT    NOT NULL CHECK (length(trim(captured_at)) > 0),
  ingested_at TEXT    NOT NULL,
  source      TEXT    NOT NULL CHECK (length(trim(source)) > 0),
  displaced   INTEGER NOT NULL CHECK (displaced IN (0, 1)),
  photo_ref   TEXT,
  supersedes  INTEGER REFERENCES tracks(id)
);

CREATE INDEX tracks_captured_at_idx ON tracks(captured_at DESC);
CREATE INDEX tracks_ingested_at_idx ON tracks(ingested_at DESC);
CREATE INDEX tracks_source_idx ON tracks(source);
CREATE INDEX tracks_supersedes_idx ON tracks(supersedes);

CREATE TABLE track_queries (
  id              INTEGER PRIMARY KEY AUTOINCREMENT,
  query           TEXT    NOT NULL CHECK (length(trim(query)) > 0),
  queried_at      TEXT    NOT NULL,
  opened_track_id INTEGER REFERENCES tracks(id),
  loop_closed_at  TEXT,
  loop_outcome    TEXT
);

CREATE INDEX track_queries_queried_at_idx ON track_queries(queried_at DESC);
CREATE INDEX track_queries_opened_track_id_idx ON track_queries(opened_track_id);
