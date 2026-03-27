package folders

import (
	"context"

	"claudepad/backend/db/generated"

	"github.com/google/uuid"
)

// ReadFolders returns all folders for the given entity type, pinned first then alphabetical.
func ReadFolders(q *generated.Queries, entityType string) ([]Folder, error) {
	rows, err := q.GetFoldersByType(context.Background(), entityType)
	if err != nil {
		return nil, err
	}
	result := make([]Folder, 0, len(rows))
	for _, r := range rows {
		result = append(result, Folder{
			ID:         r.ID,
			EntityType: r.EntityType,
			Name:       r.Name,
			Pinned:     r.Pinned != 0,
		})
	}
	return result, nil
}

// CreateFolder creates a new folder with a generated UUID and returns it.
func CreateFolder(q *generated.Queries, entityType, name string) (Folder, error) {
	id := uuid.NewString()
	err := q.CreateFolder(context.Background(), generated.CreateFolderParams{
		ID:         id,
		EntityType: entityType,
		Name:       name,
	})
	if err != nil {
		return Folder{}, err
	}
	return Folder{ID: id, EntityType: entityType, Name: name}, nil
}

// RenameFolder updates the display name of a folder.
func RenameFolder(q *generated.Queries, id, name string) error {
	return q.RenameFolder(context.Background(), generated.RenameFolderParams{
		ID:   id,
		Name: name,
	})
}

// SetFolderPinned updates the pinned status of a folder.
func SetFolderPinned(q *generated.Queries, id string, pinned bool) error {
	pinnedInt := int64(0)
	if pinned {
		pinnedInt = 1
	}
	return q.SetFolderPinned(context.Background(), generated.SetFolderPinnedParams{
		ID:     id,
		Pinned: pinnedInt,
	})
}

// DeleteFolder clears all note assignments for the folder then deletes it.
func DeleteFolder(q *generated.Queries, id string) error {
	if err := q.ClearFolderFromNotes(context.Background(), id); err != nil {
		return err
	}
	return q.DeleteFolder(context.Background(), id)
}
