-- Add a synthetic 'global' row to inference_config holding a shared URL/key.
-- Individual roles (embed/rerank/expand/asr) inherit the global values unless
-- they set their own override. SQLite cannot alter a CHECK constraint in place,
-- so the table is recreated.
CREATE TABLE inference_config_new (
    role       TEXT PRIMARY KEY CHECK(role IN ('global', 'embed', 'rerank', 'expand', 'asr')),
    api_url    TEXT,
    model      TEXT,
    api_key    TEXT,
    updated_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%SZ', 'now'))
);

INSERT INTO inference_config_new (role, api_url, model, api_key, updated_at)
    SELECT role, api_url, model, api_key, updated_at FROM inference_config;

DROP TABLE inference_config;

ALTER TABLE inference_config_new RENAME TO inference_config;
