-- Allow a 'vlm' inference role (vision model). It drives both image description
-- and OCR — same model, different prompts. Like ASR, it is model-only and
-- inherits the global/embed endpoint unless overridden. SQLite cannot alter a
-- CHECK constraint in place, so the table is recreated.
CREATE TABLE inference_config_new (
    role       TEXT PRIMARY KEY CHECK(role IN ('global', 'embed', 'rerank', 'expand', 'asr', 'vlm')),
    api_url    TEXT,
    model      TEXT,
    api_key    TEXT,
    updated_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%SZ', 'now'))
);

INSERT INTO inference_config_new (role, api_url, model, api_key, updated_at)
    SELECT role, api_url, model, api_key, updated_at FROM inference_config;

DROP TABLE inference_config;

ALTER TABLE inference_config_new RENAME TO inference_config;
