-- name: GetFoldersByType :many
SELECT id, entity_type, name, pinned
FROM folders
WHERE entity_type = ?
ORDER BY pinned DESC, name ASC;

-- name: CreateFolder :exec
INSERT INTO folders (id, entity_type, name) VALUES (?, ?, ?);

-- name: RenameFolder :exec
UPDATE folders SET name = ? WHERE id = ?;

-- name: SetFolderPinned :exec
UPDATE folders SET pinned = ? WHERE id = ?;

-- name: DeleteFolder :exec
DELETE FROM folders WHERE id = ?;
