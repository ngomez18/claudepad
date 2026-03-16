package notes

import (
	"database/sql"
	"os"
	"path/filepath"
	"testing"
	"time"

	"claudepad/backend/db/generated"

	_ "modernc.org/sqlite"
)

func writeNote(t *testing.T, dir, name, content string) {
	t.Helper()
	if err := os.WriteFile(filepath.Join(dir, name), []byte(content), 0o600); err != nil {
		t.Fatalf("write note: %v", err)
	}
}

func openTestQueries(t *testing.T) *generated.Queries {
	t.Helper()
	db, err := sql.Open("sqlite", ":memory:")
	if err != nil {
		t.Fatalf("open db: %v", err)
	}
	_, err = db.Exec(`CREATE TABLE file_metadata (
		id            TEXT PRIMARY KEY,
		real_path     TEXT NOT NULL UNIQUE,
		file_type     TEXT NOT NULL,
		friendly_name TEXT,
		tags          TEXT NOT NULL DEFAULT '[]',
		notes         TEXT NOT NULL DEFAULT '',
		archived      INTEGER NOT NULL DEFAULT 0,
		pinned        INTEGER NOT NULL DEFAULT 0,
		project_id    TEXT    NOT NULL DEFAULT '',
		created_at    DATETIME DEFAULT (datetime('now')),
		updated_at    DATETIME DEFAULT (datetime('now'))
	)`)
	if err != nil {
		t.Fatalf("create table: %v", err)
	}
	t.Cleanup(func() { db.Close() })
	return generated.New(db)
}

func TestReadNotesFrom_Empty(t *testing.T) {
	q := openTestQueries(t)
	got, err := readNotesFrom(q, t.TempDir())
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
	if len(got) != 0 {
		t.Errorf("expected 0 notes, got %d", len(got))
	}
}

func TestReadNotesFrom_DirNotExist(t *testing.T) {
	q := openTestQueries(t)
	got, err := readNotesFrom(q, filepath.Join(t.TempDir(), "nonexistent"))
	if err != nil {
		t.Fatalf("expected no error for missing dir, got: %v", err)
	}
	if len(got) != 0 {
		t.Errorf("expected 0 notes, got %d", len(got))
	}
}

func TestReadNotesFrom_SkipsNonMarkdown(t *testing.T) {
	q := openTestQueries(t)
	dir := t.TempDir()
	writeNote(t, dir, "note.md", "# Note\n")
	os.WriteFile(filepath.Join(dir, "other.txt"), []byte("ignore"), 0o600)
	os.Mkdir(filepath.Join(dir, "subdir"), 0o700)

	got, err := readNotesFrom(q, dir)
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
	if len(got) != 1 {
		t.Errorf("expected 1 note, got %d", len(got))
	}
}

func TestReadNotesFrom_ParsesFrontmatter(t *testing.T) {
	q := openTestQueries(t)
	dir := t.TempDir()
	writeNote(t, dir, "2024-01-15-go-streams.md", `---
title: How streams work in Go
project: /Users/user/myproject
---

Body content here.
`)

	got, err := readNotesFrom(q, dir)
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
	if len(got) != 1 {
		t.Fatalf("expected 1 note, got %d", len(got))
	}
	n := got[0]
	if n.Title != "How streams work in Go" {
		t.Errorf("Title: got %q, want %q", n.Title, "How streams work in Go")
	}
	if n.Project != "/Users/user/myproject" {
		t.Errorf("Project: got %q, want %q", n.Project, "/Users/user/myproject")
	}
	if n.Content != "Body content here.\n" {
		t.Errorf("Content: got %q", n.Content)
	}
}

func TestReadNotesFrom_FallbackTitle(t *testing.T) {
	q := openTestQueries(t)
	dir := t.TempDir()
	writeNote(t, dir, "2024-01-15-how-channels-work.md", "# Body\n")

	got, err := readNotesFrom(q, dir)
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
	if got[0].Title != "How channels work" {
		t.Errorf("Title: got %q, want %q", got[0].Title, "How channels work")
	}
}

func TestReadNotesFrom_SortedNewestFirst(t *testing.T) {
	q := openTestQueries(t)
	dir := t.TempDir()

	older := filepath.Join(dir, "older.md")
	newer := filepath.Join(dir, "newer.md")
	os.WriteFile(older, []byte("old"), 0o600)
	os.WriteFile(newer, []byte("new"), 0o600)

	old := time.Now().Add(-24 * time.Hour)
	now := time.Now()
	os.Chtimes(older, old, old)
	os.Chtimes(newer, now, now)

	got, err := readNotesFrom(q, dir)
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
	if len(got) != 2 {
		t.Fatalf("expected 2 notes, got %d", len(got))
	}
	if got[0].Filename != "newer" {
		t.Errorf("expected newest first, got %q", got[0].Filename)
	}
}

func TestSetNoteTitle_RoundTrip(t *testing.T) {
	q := openTestQueries(t)
	dir := t.TempDir()
	writeNote(t, dir, "my-note.md", "# Body\n")
	notePath := filepath.Join(dir, "my-note.md")

	if err := SetNoteTitle(q, notePath, "My Friendly Title"); err != nil {
		t.Fatalf("SetNoteTitle: %v", err)
	}

	notes, _ := readNotesFrom(q, dir)
	if notes[0].Title != "My Friendly Title" {
		t.Errorf("Title: got %q, want %q", notes[0].Title, "My Friendly Title")
	}

	// Clear
	if err := SetNoteTitle(q, notePath, ""); err != nil {
		t.Fatalf("SetNoteTitle clear: %v", err)
	}
	notes2, _ := readNotesFrom(q, dir)
	if notes2[0].Title == "My Friendly Title" {
		t.Error("expected title cleared")
	}
}

func TestSetNoteMeta_RoundTrip(t *testing.T) {
	q := openTestQueries(t)
	dir := t.TempDir()
	writeNote(t, dir, "meta-note.md", "# Body\n")
	notePath := filepath.Join(dir, "meta-note.md")

	meta := NoteMeta{
		Tags:     []string{"go", "concurrency"},
		Pinned:   true,
		Notes:    "Private annotation",
		Archived: false,
	}
	if err := SetNoteMeta(q, notePath, meta); err != nil {
		t.Fatalf("SetNoteMeta: %v", err)
	}

	notes, _ := readNotesFrom(q, dir)
	n := notes[0]
	if !n.Pinned {
		t.Error("expected Pinned=true")
	}
	if len(n.Tags) != 2 || n.Tags[0] != "go" || n.Tags[1] != "concurrency" {
		t.Errorf("Tags: got %v", n.Tags)
	}
	if n.Notes != "Private annotation" {
		t.Errorf("Notes: got %q", n.Notes)
	}
	if n.Archived {
		t.Error("expected Archived=false")
	}
}

func TestSetNoteMeta_DoesNotClobberTitle(t *testing.T) {
	q := openTestQueries(t)
	dir := t.TempDir()
	writeNote(t, dir, "note.md", "# Body\n")
	notePath := filepath.Join(dir, "note.md")

	if err := SetNoteTitle(q, notePath, "Keep This Title"); err != nil {
		t.Fatalf("SetNoteTitle: %v", err)
	}
	if err := SetNoteMeta(q, notePath, NoteMeta{Tags: []string{"x"}}); err != nil {
		t.Fatalf("SetNoteMeta: %v", err)
	}

	notes, _ := readNotesFrom(q, dir)
	if notes[0].Title != "Keep This Title" {
		t.Errorf("SetNoteMeta clobbered Title: got %q", notes[0].Title)
	}
}

func TestSortNotes_PinnedBeforeUnpinned(t *testing.T) {
	noteList := []Note{
		{Filename: "a", ModifiedAt: "2024-01-03T00:00:00Z", Pinned: false},
		{Filename: "b", ModifiedAt: "2024-01-01T00:00:00Z", Pinned: true},
		{Filename: "c", ModifiedAt: "2024-01-02T00:00:00Z", Pinned: false},
	}
	sortNotes(noteList)

	if noteList[0].Filename != "b" {
		t.Errorf("expected pinned note first, got %q", noteList[0].Filename)
	}
	if noteList[1].Filename != "a" {
		t.Errorf("expected newest unpinned second, got %q", noteList[1].Filename)
	}
}

func TestFilenameToTitle_WithDatePrefix(t *testing.T) {
	got := filenameToTitle("2024-01-15-how-channels-work")
	if got != "How channels work" {
		t.Errorf("got %q, want %q", got, "How channels work")
	}
}

func TestFilenameToTitle_WithoutDatePrefix(t *testing.T) {
	got := filenameToTitle("my-note")
	if got != "My note" {
		t.Errorf("got %q, want %q", got, "My note")
	}
}

func TestParseFrontmatter_ExtractsFields(t *testing.T) {
	raw := "---\ntitle: Test Title\nproject: /foo/bar\n---\n\nBody text.\n"
	meta, body := parseFrontmatter(raw)
	if meta["title"] != "Test Title" {
		t.Errorf("title: got %q", meta["title"])
	}
	if meta["project"] != "/foo/bar" {
		t.Errorf("project: got %q", meta["project"])
	}
	if body != "Body text.\n" {
		t.Errorf("body: got %q", body)
	}
}

func TestParseFrontmatter_NoFrontmatter(t *testing.T) {
	raw := "# Just a title\n\nBody.\n"
	meta, body := parseFrontmatter(raw)
	if len(meta) != 0 {
		t.Errorf("expected empty meta, got %v", meta)
	}
	if body != raw {
		t.Errorf("body should be original content")
	}
}
