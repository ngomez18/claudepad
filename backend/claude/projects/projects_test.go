package projects

import (
	"database/sql"
	"os"
	"path/filepath"
	"testing"

	_ "modernc.org/sqlite"
)

// openTestDB creates an in-memory SQLite DB with the projects table.
func openTestDB(t *testing.T) *sql.DB {
	t.Helper()
	db, err := sql.Open("sqlite", ":memory:?_foreign_keys=on")
	if err != nil {
		t.Fatalf("open test db: %v", err)
	}
	_, err = db.Exec(`CREATE TABLE IF NOT EXISTS projects (
		id          TEXT PRIMARY KEY,
		name        TEXT,
		real_path   TEXT NOT NULL UNIQUE,
		is_global   INTEGER DEFAULT 0,
		last_opened DATETIME,
		created_at  DATETIME DEFAULT (datetime('now'))
	)`)
	if err != nil {
		t.Fatalf("create table: %v", err)
	}
	t.Cleanup(func() { db.Close() })
	return db
}

// writeJSONL writes a .jsonl file into dir and returns its path.
func writeJSONL(t *testing.T, dir, name, content string) string {
	t.Helper()
	path := filepath.Join(dir, name)
	if err := os.WriteFile(path, []byte(content), 0o600); err != nil {
		t.Fatalf("write jsonl: %v", err)
	}
	return path
}

// ── encodeProjectPath ─────────────────────────────────────────────────────────

func TestEncodeProjectPath(t *testing.T) {
	cases := []struct{ in, want string }{
		{"/Users/alice/code/myapp", "-Users-alice-code-myapp"},
		{"/home/bob/proj", "-home-bob-proj"},
		{"/", "-"},
	}
	for _, c := range cases {
		got := encodeProjectPath(c.in)
		if got != c.want {
			t.Errorf("encodeProjectPath(%q) = %q, want %q", c.in, got, c.want)
		}
	}
}

// ── cwdFromFile ───────────────────────────────────────────────────────────────

func TestCwdFromFile_Found(t *testing.T) {
	dir := t.TempDir()
	path := writeJSONL(t, dir, "s.jsonl",
		`{"type":"meta","cwd":"/Users/alice/code/myapp"}`+"\n",
	)
	got := cwdFromFile(path)
	if got != "/Users/alice/code/myapp" {
		t.Errorf("got %q, want %q", got, "/Users/alice/code/myapp")
	}
}

func TestCwdFromFile_NotFound(t *testing.T) {
	dir := t.TempDir()
	path := writeJSONL(t, dir, "s.jsonl", `{"type":"meta"}`+"\n")
	if got := cwdFromFile(path); got != "" {
		t.Errorf("expected empty, got %q", got)
	}
}

func TestCwdFromFile_MissingFile(t *testing.T) {
	if got := cwdFromFile("/nonexistent/path.jsonl"); got != "" {
		t.Errorf("expected empty for missing file, got %q", got)
	}
}

// ── resolveRealPath ───────────────────────────────────────────────────────────

func TestResolveRealPath_FromJsonl(t *testing.T) {
	root := t.TempDir()
	encoded := "-Users-alice-code-myapp"
	dir := filepath.Join(root, encoded)
	os.Mkdir(dir, 0o700)
	writeJSONL(t, dir, "sess.jsonl", `{"cwd":"/Users/alice/code/myapp"}`+"\n")

	got := resolveRealPath(dir, encoded)
	if got != "/Users/alice/code/myapp" {
		t.Errorf("got %q, want %q", got, "/Users/alice/code/myapp")
	}
}

func TestResolveRealPath_Fallback(t *testing.T) {
	// No .jsonl files — falls back to decoding the encoded name.
	dir := t.TempDir()
	encoded := "-Users-bob-project"
	got := resolveRealPath(dir, encoded)
	if got != "/Users/bob/project" {
		t.Errorf("got %q, want %q", got, "/Users/bob/project")
	}
}

// ── ReadProjects ──────────────────────────────────────────────────────────────

func TestReadProjects_CreatesGlobalRow(t *testing.T) {
	db := openTestDB(t)
	claudeDir := t.TempDir()

	projects, err := ReadProjects(db, claudeDir)
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
	if len(projects) != 1 {
		t.Fatalf("expected 1 project (global), got %d", len(projects))
	}
	g := projects[0]
	if !g.IsGlobal {
		t.Error("expected is_global = true")
	}
	if g.RealPath != claudeDir {
		t.Errorf("RealPath: got %q, want %q", g.RealPath, claudeDir)
	}
	if g.Name != "Global" {
		t.Errorf("Name: got %q, want %q", g.Name, "Global")
	}
}

func TestReadProjects_GlobalIdempotent(t *testing.T) {
	db := openTestDB(t)
	claudeDir := t.TempDir()

	// Call twice — should not duplicate the global row.
	if _, err := ReadProjects(db, claudeDir); err != nil {
		t.Fatalf("first call error: %v", err)
	}
	projects, err := ReadProjects(db, claudeDir)
	if err != nil {
		t.Fatalf("second call error: %v", err)
	}
	if len(projects) != 1 {
		t.Errorf("expected 1 project after two calls, got %d", len(projects))
	}
}

func TestReadProjects_GlobalFirst(t *testing.T) {
	db := openTestDB(t)
	claudeDir := t.TempDir()

	// Add a non-global project first.
	p := t.TempDir()
	if _, err := AddProject(db, p); err != nil {
		t.Fatalf("AddProject: %v", err)
	}

	projects, err := ReadProjects(db, claudeDir)
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
	if len(projects) < 2 {
		t.Fatalf("expected at least 2 projects, got %d", len(projects))
	}
	if !projects[0].IsGlobal {
		t.Error("expected global project to be first")
	}
}

func TestReadProjects_EncodedNameDerived(t *testing.T) {
	db := openTestDB(t)
	claudeDir := t.TempDir()

	projects, err := ReadProjects(db, claudeDir)
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
	g := projects[0]
	want := encodeProjectPath(claudeDir)
	if g.EncodedName != want {
		t.Errorf("EncodedName: got %q, want %q", g.EncodedName, want)
	}
}

// ── DiscoverProjects ──────────────────────────────────────────────────────────

func TestDiscoverProjects_Empty(t *testing.T) {
	db := openTestDB(t)
	claudeDir := t.TempDir()
	os.Mkdir(filepath.Join(claudeDir, "projects"), 0o700)

	got, err := DiscoverProjects(db, claudeDir)
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
	if len(got) != 0 {
		t.Errorf("expected 0, got %d", len(got))
	}
}

func TestDiscoverProjects_NoDirIsOk(t *testing.T) {
	db := openTestDB(t)
	claudeDir := t.TempDir() // no "projects" subdir

	got, err := DiscoverProjects(db, claudeDir)
	if err != nil {
		t.Fatalf("expected no error for missing projects dir, got: %v", err)
	}
	if len(got) != 0 {
		t.Errorf("expected 0, got %d", len(got))
	}
}

func TestDiscoverProjects_ReturnsUnknown(t *testing.T) {
	db := openTestDB(t)
	claudeDir := t.TempDir()
	projectsDir := filepath.Join(claudeDir, "projects")
	os.Mkdir(projectsDir, 0o700)

	// Create an encoded project directory with a session file.
	encoded := "-Users-alice-code-myapp"
	projDir := filepath.Join(projectsDir, encoded)
	os.Mkdir(projDir, 0o700)
	writeJSONL(t, projDir, "sess.jsonl", `{"cwd":"/Users/alice/code/myapp"}`+"\n")

	got, err := DiscoverProjects(db, claudeDir)
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
	if len(got) != 1 {
		t.Fatalf("expected 1 discovered project, got %d", len(got))
	}
	if got[0].RealPath != "/Users/alice/code/myapp" {
		t.Errorf("RealPath: got %q", got[0].RealPath)
	}
}

func TestDiscoverProjects_SkipsKnown(t *testing.T) {
	db := openTestDB(t)
	claudeDir := t.TempDir()
	projectsDir := filepath.Join(claudeDir, "projects")
	os.Mkdir(projectsDir, 0o700)

	realPath := t.TempDir()
	encoded := encodeProjectPath(realPath)
	projDir := filepath.Join(projectsDir, encoded)
	os.Mkdir(projDir, 0o700)
	writeJSONL(t, projDir, "sess.jsonl", `{"cwd":"`+realPath+`"}`+"\n")

	// Pre-register so it's known.
	if _, err := AddProject(db, realPath); err != nil {
		t.Fatalf("AddProject: %v", err)
	}

	got, err := DiscoverProjects(db, claudeDir)
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
	if len(got) != 0 {
		t.Errorf("expected 0 (already known), got %d", len(got))
	}
}

// ── AddProject ────────────────────────────────────────────────────────────────

func TestAddProject_Success(t *testing.T) {
	db := openTestDB(t)
	realPath := t.TempDir()

	p, err := AddProject(db, realPath)
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
	if p.ID == "" {
		t.Error("expected non-empty ID")
	}
	if p.RealPath != realPath {
		t.Errorf("RealPath: got %q, want %q", p.RealPath, realPath)
	}
	if p.Name != filepath.Base(realPath) {
		t.Errorf("Name: got %q, want %q", p.Name, filepath.Base(realPath))
	}
	if p.EncodedName != encodeProjectPath(realPath) {
		t.Errorf("EncodedName: got %q", p.EncodedName)
	}
}

func TestAddProject_NonExistentPath(t *testing.T) {
	db := openTestDB(t)
	_, err := AddProject(db, "/nonexistent/path/that/does/not/exist")
	if err == nil {
		t.Error("expected error for non-existent path")
	}
}

func TestAddProject_Idempotent(t *testing.T) {
	db := openTestDB(t)
	realPath := t.TempDir()

	p1, err := AddProject(db, realPath)
	if err != nil {
		t.Fatalf("first AddProject: %v", err)
	}
	p2, err := AddProject(db, realPath)
	if err != nil {
		t.Fatalf("second AddProject: %v", err)
	}
	if p1.ID != p2.ID {
		t.Errorf("expected same ID on duplicate add: got %q vs %q", p1.ID, p2.ID)
	}
}

// ── RemoveProject ─────────────────────────────────────────────────────────────

func TestRemoveProject_Success(t *testing.T) {
	db := openTestDB(t)
	realPath := t.TempDir()

	p, err := AddProject(db, realPath)
	if err != nil {
		t.Fatalf("AddProject: %v", err)
	}
	if err := RemoveProject(db, p.ID); err != nil {
		t.Fatalf("RemoveProject: %v", err)
	}

	// Confirm it's gone.
	var count int
	db.QueryRow(`SELECT COUNT(*) FROM projects WHERE id = ?`, p.ID).Scan(&count)
	if count != 0 {
		t.Error("expected row to be deleted")
	}
}

func TestRemoveProject_RefusesGlobal(t *testing.T) {
	db := openTestDB(t)
	claudeDir := t.TempDir()

	projects, err := ReadProjects(db, claudeDir)
	if err != nil {
		t.Fatalf("ReadProjects: %v", err)
	}
	globalID := projects[0].ID

	if err := RemoveProject(db, globalID); err == nil {
		t.Error("expected error when removing global project")
	}
}

// ── UpdateLastOpened ──────────────────────────────────────────────────────────

func TestUpdateLastOpened(t *testing.T) {
	db := openTestDB(t)
	realPath := t.TempDir()

	p, err := AddProject(db, realPath)
	if err != nil {
		t.Fatalf("AddProject: %v", err)
	}
	if err := UpdateLastOpened(db, p.ID); err != nil {
		t.Fatalf("UpdateLastOpened: %v", err)
	}

	var lastOpened sql.NullString
	db.QueryRow(`SELECT last_opened FROM projects WHERE id = ?`, p.ID).Scan(&lastOpened)
	if !lastOpened.Valid || lastOpened.String == "" {
		t.Error("expected last_opened to be set")
	}
}
