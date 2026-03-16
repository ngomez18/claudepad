-- name: GetPlanMeta :one
SELECT friendly_name, pinned, project_id, tags, notes, archived
FROM file_metadata WHERE real_path = ? AND file_type = 'plan';

-- name: UpsertPlanName :exec
INSERT INTO file_metadata (id, real_path, file_type, friendly_name)
VALUES (?, ?, 'plan', ?)
ON CONFLICT(real_path) DO UPDATE SET
    friendly_name = excluded.friendly_name,
    updated_at    = datetime('now');

-- name: ClearPlanName :exec
UPDATE file_metadata
SET friendly_name = NULL, updated_at = datetime('now')
WHERE real_path = ? AND file_type = 'plan';

-- name: UpsertPlanMeta :exec
INSERT INTO file_metadata (id, real_path, file_type, pinned, project_id, tags, notes, archived)
VALUES (?, ?, 'plan', ?, ?, ?, ?, ?)
ON CONFLICT(real_path) DO UPDATE SET
    pinned     = excluded.pinned,
    project_id = excluded.project_id,
    tags       = excluded.tags,
    notes      = excluded.notes,
    archived   = excluded.archived,
    updated_at = datetime('now');

-- name: GetNoteMeta :one
SELECT friendly_name, pinned, tags, notes, archived
FROM file_metadata WHERE real_path = ? AND file_type = 'note';

-- name: UpsertNoteTitle :exec
INSERT INTO file_metadata (id, real_path, file_type, friendly_name)
VALUES (?, ?, 'note', ?)
ON CONFLICT(real_path) DO UPDATE SET
    friendly_name = excluded.friendly_name,
    updated_at    = datetime('now');

-- name: ClearNoteTitle :exec
UPDATE file_metadata
SET friendly_name = NULL, updated_at = datetime('now')
WHERE real_path = ? AND file_type = 'note';

-- name: UpsertNoteMeta :exec
INSERT INTO file_metadata (id, real_path, file_type, pinned, tags, notes, archived)
VALUES (?, ?, 'note', ?, ?, ?, ?)
ON CONFLICT(real_path) DO UPDATE SET
    pinned     = excluded.pinned,
    tags       = excluded.tags,
    notes      = excluded.notes,
    archived   = excluded.archived,
    updated_at = datetime('now');
