-- name: ListProjects :many
SELECT id, name, real_path, is_global, last_opened, created_at
FROM projects
ORDER BY is_global DESC, last_opened DESC;

-- name: GetProjectByRealPath :one
SELECT id, name, real_path, is_global, last_opened, created_at
FROM projects WHERE real_path = ?;

-- name: GetProjectByID :one
SELECT id, name, real_path, is_global, last_opened, created_at
FROM projects WHERE id = ?;

-- name: InsertProject :exec
INSERT INTO projects (id, name, real_path, is_global, last_opened)
VALUES (?, ?, ?, 0, datetime('now'))
ON CONFLICT(real_path) DO NOTHING;

-- name: UpsertGlobalProject :exec
INSERT INTO projects (id, name, real_path, is_global, last_opened)
VALUES (?, 'Global', ?, 1, datetime('now'))
ON CONFLICT(real_path) DO NOTHING;

-- name: DeleteProject :exec
DELETE FROM projects WHERE id = ?;

-- name: UpdateProjectLastOpened :exec
UPDATE projects SET last_opened = datetime('now') WHERE id = ?;

-- name: ListProjectPaths :many
SELECT real_path FROM projects;
