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
