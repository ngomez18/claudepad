package folders_test

import (
	"database/sql"
	"testing"

	"claudepad/backend/claude/folders"
	"claudepad/backend/db/generated"

	_ "modernc.org/sqlite"
)

func openTestQueries(t *testing.T) *generated.Queries {
	t.Helper()
	conn, err := sql.Open("sqlite", ":memory:")
	if err != nil {
		t.Fatalf("open db: %v", err)
	}
	_, err = conn.Exec(`
		CREATE TABLE folders (
			id          TEXT PRIMARY KEY,
			entity_type TEXT    NOT NULL,
			name        TEXT    NOT NULL,
			pinned      INTEGER NOT NULL DEFAULT 0,
			created_at  DATETIME DEFAULT (datetime('now')),
			UNIQUE(entity_type, name)
		);
		CREATE TABLE file_metadata (
			id         TEXT PRIMARY KEY,
			real_path  TEXT NOT NULL UNIQUE,
			file_type  TEXT NOT NULL,
			folder_id  TEXT NOT NULL DEFAULT '',
			updated_at DATETIME DEFAULT (datetime('now'))
		);
	`)
	if err != nil {
		t.Fatalf("create tables: %v", err)
	}
	t.Cleanup(func() { conn.Close() })
	return generated.New(conn)
}

func TestCreateAndReadFolders(t *testing.T) {
	q := openTestQueries(t)

	f, err := folders.CreateFolder(q, "note", "Work")
	if err != nil {
		t.Fatalf("CreateFolder: %v", err)
	}
	if f.ID == "" {
		t.Error("expected non-empty ID")
	}
	if f.Name != "Work" {
		t.Errorf("name: got %q, want %q", f.Name, "Work")
	}
	if f.Pinned {
		t.Error("expected unpinned by default")
	}

	list, err := folders.ReadFolders(q, "note")
	if err != nil {
		t.Fatalf("ReadFolders: %v", err)
	}
	if len(list) != 1 || list[0].ID != f.ID {
		t.Errorf("expected 1 folder, got %v", list)
	}
}

func TestRenameFolder(t *testing.T) {
	q := openTestQueries(t)
	f, _ := folders.CreateFolder(q, "note", "Old")

	if err := folders.RenameFolder(q, f.ID, "New"); err != nil {
		t.Fatalf("RenameFolder: %v", err)
	}

	list, _ := folders.ReadFolders(q, "note")
	if list[0].Name != "New" {
		t.Errorf("got %q, want %q", list[0].Name, "New")
	}
}

func TestSetFolderPinned(t *testing.T) {
	q := openTestQueries(t)
	f, _ := folders.CreateFolder(q, "note", "A")

	if err := folders.SetFolderPinned(q, f.ID, true); err != nil {
		t.Fatalf("SetFolderPinned: %v", err)
	}

	list, _ := folders.ReadFolders(q, "note")
	if !list[0].Pinned {
		t.Error("expected pinned=true")
	}
}

func TestPinnedFoldersSortFirst(t *testing.T) {
	q := openTestQueries(t)
	a, _ := folders.CreateFolder(q, "note", "Alpha")
	_, _ = folders.CreateFolder(q, "note", "Beta")
	_ = folders.SetFolderPinned(q, a.ID, true)

	list, _ := folders.ReadFolders(q, "note")
	if list[0].Name != "Alpha" {
		t.Errorf("pinned folder should be first, got %q", list[0].Name)
	}
}

func TestDeleteFolder(t *testing.T) {
	q := openTestQueries(t)
	f, _ := folders.CreateFolder(q, "note", "Temp")

	if err := folders.DeleteFolder(q, f.ID); err != nil {
		t.Fatalf("DeleteFolder: %v", err)
	}

	list, _ := folders.ReadFolders(q, "note")
	if len(list) != 0 {
		t.Errorf("expected 0 folders after delete, got %d", len(list))
	}
}

func TestEntityTypeIsolation(t *testing.T) {
	q := openTestQueries(t)
	_, _ = folders.CreateFolder(q, "note", "Shared Name")
	_, _ = folders.CreateFolder(q, "plan", "Shared Name")

	notes, _ := folders.ReadFolders(q, "note")
	plans, _ := folders.ReadFolders(q, "plan")

	if len(notes) != 1 || len(plans) != 1 {
		t.Errorf("entity type isolation failed: notes=%d plans=%d", len(notes), len(plans))
	}
}
