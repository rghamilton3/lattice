CREATE TABLE inference_config (
    role       TEXT PRIMARY KEY CHECK(role IN ('embed', 'rerank', 'expand', 'asr')),
    api_url    TEXT,
    model      TEXT,
    api_key    TEXT,
    updated_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%SZ', 'now'))
);

CREATE TABLE agent_tokens (
    id         INTEGER PRIMARY KEY AUTOINCREMENT,
    token      TEXT NOT NULL,
    created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%SZ', 'now')),
    active     INTEGER NOT NULL DEFAULT 1
);

CREATE INDEX idx_agent_tokens_active ON agent_tokens(active);
