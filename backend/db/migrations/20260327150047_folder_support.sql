-- +goose Up
CREATE TABLE folders (
    id          TEXT PRIMARY KEY,
    entity_type TEXT    NOT NULL,
    name        TEXT    NOT NULL,
    pinned      INTEGER NOT NULL DEFAULT 0,
    created_at  DATETIME DEFAULT (datetime('now')),
    UNIQUE(entity_type, name)
);

ALTER TABLE file_metadata ADD COLUMN folder_id TEXT NOT NULL DEFAULT '';

-- +goose Down
ALTER TABLE file_metadata DROP COLUMN folder_id;
DROP TABLE folders;
