-- +goose Up
ALTER TABLE file_metadata ADD COLUMN pinned     INTEGER NOT NULL DEFAULT 0;
ALTER TABLE file_metadata ADD COLUMN project_id TEXT    NOT NULL DEFAULT '';

-- +goose Down
-- SQLite does not support DROP COLUMN in all versions; no-op for development.
