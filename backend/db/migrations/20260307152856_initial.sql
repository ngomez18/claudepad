-- +goose Up
CREATE TABLE IF NOT EXISTS projects (
    id          TEXT PRIMARY KEY,
    name        TEXT,
    real_path   TEXT NOT NULL UNIQUE,
    is_global   INTEGER DEFAULT 0,
    last_opened DATETIME,
    created_at  DATETIME DEFAULT (datetime('now'))
);
CREATE TABLE IF NOT EXISTS file_metadata (
    id            TEXT PRIMARY KEY,
    real_path     TEXT NOT NULL UNIQUE,
    file_type     TEXT NOT NULL,
    friendly_name TEXT,
    tags          TEXT NOT NULL DEFAULT '[]',
    notes         TEXT NOT NULL DEFAULT '',
    archived      INTEGER NOT NULL DEFAULT 0,
    created_at    DATETIME DEFAULT (datetime('now')),
    updated_at    DATETIME DEFAULT (datetime('now'))
);
CREATE TABLE IF NOT EXISTS usage_snapshots (
    id            INTEGER PRIMARY KEY AUTOINCREMENT,
    snapshot_date DATE NOT NULL UNIQUE,
    raw_json      TEXT NOT NULL,
    captured_at   DATETIME DEFAULT (datetime('now'))
);
CREATE TABLE IF NOT EXISTS app_settings (
    key        TEXT PRIMARY KEY,
    value      TEXT NOT NULL,
    updated_at DATETIME DEFAULT (datetime('now'))
);

-- +goose Down
DROP TABLE IF EXISTS app_settings;
DROP TABLE IF EXISTS usage_snapshots;
DROP TABLE IF EXISTS file_metadata;
DROP TABLE IF EXISTS projects;
