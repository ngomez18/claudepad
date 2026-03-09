package plans

import (
	"database/sql"
	"os"
	"path/filepath"
	"testing"
	"time"

	"claudepad/backend/db/generated"

	_ "modernc.org/sqlite"
)

func writePlan(t *testing.T, dir, name, content string) {
	t.Helper()
	if err := os.WriteFile(filepath.Join(dir, name), []byte(content), 0o600); err != nil {
		t.Fatalf("write plan: %v", err)
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

func TestReadPlansFrom_Empty(t *testing.T) {
	got, err := readPlansFrom(t.TempDir())
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
	if len(got) != 0 {
		t.Errorf("expected 0 plans, got %d", len(got))
	}
}

func TestReadPlansFrom_DirNotExist(t *testing.T) {
	got, err := readPlansFrom(filepath.Join(t.TempDir(), "nonexistent"))
	if err != nil {
		t.Fatalf("expected no error for missing dir, got: %v", err)
	}
	if len(got) != 0 {
		t.Errorf("expected 0 plans, got %d", len(got))
	}
}

func TestReadPlansFrom_ParsesTodos(t *testing.T) {
	dir := t.TempDir()
	writePlan(t, dir, "my-plan.md", `# My Plan

- [x] Done task
- [X] Also done
- [ ] Pending task
- [ ] Another pending
`)

	plans, err := readPlansFrom(dir)
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
	if len(plans) != 1 {
		t.Fatalf("expected 1 plan, got %d", len(plans))
	}

	p := plans[0]
	if p.Filename != "my-plan" {
		t.Errorf("Filename: got %q, want %q", p.Filename, "my-plan")
	}
	if p.TodoDone != 2 {
		t.Errorf("TodoDone: got %d, want 2", p.TodoDone)
	}
	if p.TodoTotal != 4 {
		t.Errorf("TodoTotal: got %d, want 4", p.TodoTotal)
	}
}

func TestReadPlansFrom_NoTodos(t *testing.T) {
	dir := t.TempDir()
	writePlan(t, dir, "plain.md", "# Just a plan\n\nNo checkboxes here.\n")

	plans, err := readPlansFrom(dir)
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
	if plans[0].TodoTotal != 0 {
		t.Errorf("TodoTotal: got %d, want 0", plans[0].TodoTotal)
	}
}

func TestReadPlansFrom_SkipsNonMarkdown(t *testing.T) {
	dir := t.TempDir()
	writePlan(t, dir, "plan.md", "# Plan\n")
	os.WriteFile(filepath.Join(dir, "notes.txt"), []byte("ignore me"), 0o600)
	os.Mkdir(filepath.Join(dir, "subdir"), 0o700)

	plans, err := readPlansFrom(dir)
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
	if len(plans) != 1 {
		t.Errorf("expected 1 plan, got %d", len(plans))
	}
}

func TestReadPlansFrom_SortedNewestFirst(t *testing.T) {
	dir := t.TempDir()

	older := filepath.Join(dir, "older.md")
	newer := filepath.Join(dir, "newer.md")
	os.WriteFile(older, []byte("old"), 0o600)
	os.WriteFile(newer, []byte("new"), 0o600)

	// Set mtime explicitly
	old := time.Now().Add(-24 * time.Hour)
	now := time.Now()
	os.Chtimes(older, old, old)
	os.Chtimes(newer, now, now)

	plans, err := readPlansFrom(dir)
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
	if len(plans) != 2 {
		t.Fatalf("expected 2 plans, got %d", len(plans))
	}
	if plans[0].Filename != "newer" {
		t.Errorf("expected newest first, got %q", plans[0].Filename)
	}
}

func TestSetAndGetPlanName(t *testing.T) {
	dir := t.TempDir()
	writePlan(t, dir, "my-plan.md", "# My Plan\n")
	q := openTestQueries(t)
	planPath := filepath.Join(dir, "my-plan.md")

	// Before setting name: Name should be empty
	plans, err := readPlansFrom(dir)
	if err != nil {
		t.Fatalf("readPlansFrom: %v", err)
	}
	if plans[0].Name != "" {
		t.Errorf("expected empty Name before set, got %q", plans[0].Name)
	}

	// Set friendly name
	if err := SetPlanName(q, planPath, "My Friendly Name"); err != nil {
		t.Fatalf("SetPlanName: %v", err)
	}

	// Verify via enrichment
	planList, _ := readPlansFrom(dir)
	enrichPlansFromDB(q, planList)
	if planList[0].Name != "My Friendly Name" {
		t.Errorf("expected Name %q, got %q", "My Friendly Name", planList[0].Name)
	}

	// Upsert with a new name
	if err := SetPlanName(q, planPath, "Updated Name"); err != nil {
		t.Fatalf("SetPlanName upsert: %v", err)
	}
	planList2, _ := readPlansFrom(dir)
	enrichPlansFromDB(q, planList2)
	if planList2[0].Name != "Updated Name" {
		t.Errorf("expected upserted name %q, got %q", "Updated Name", planList2[0].Name)
	}

	// Clear the name
	if err := SetPlanName(q, planPath, ""); err != nil {
		t.Fatalf("SetPlanName clear: %v", err)
	}
	planList3, _ := readPlansFrom(dir)
	enrichPlansFromDB(q, planList3)
	if planList3[0].Name != "" {
		t.Errorf("expected empty Name after clear, got %q", planList3[0].Name)
	}
}

func TestSetPlanMeta_RoundTrip(t *testing.T) {
	dir := t.TempDir()
	writePlan(t, dir, "meta-plan.md", "# Plan\n\nSome words here.\n")
	q := openTestQueries(t)
	planPath := filepath.Join(dir, "meta-plan.md")

	meta := PlanMeta{
		Pinned:    true,
		ProjectID: "proj-abc",
		Tags:      []string{"feature", "backend"},
		Notes:     "Important notes",
		Archived:  false,
	}

	if err := SetPlanMeta(q, planPath, meta); err != nil {
		t.Fatalf("SetPlanMeta: %v", err)
	}

	plans, _ := readPlansFrom(dir)
	enrichPlansFromDB(q, plans)
	p := plans[0]

	if !p.Pinned {
		t.Error("expected Pinned=true")
	}
	if p.ProjectID != "proj-abc" {
		t.Errorf("ProjectID: got %q, want %q", p.ProjectID, "proj-abc")
	}
	if len(p.Tags) != 2 || p.Tags[0] != "feature" || p.Tags[1] != "backend" {
		t.Errorf("Tags: got %v", p.Tags)
	}
	if p.Notes != "Important notes" {
		t.Errorf("Notes: got %q", p.Notes)
	}
	if p.Archived {
		t.Error("expected Archived=false")
	}
}

func TestSetPlanMeta_DoesNotClobberName(t *testing.T) {
	dir := t.TempDir()
	writePlan(t, dir, "plan.md", "# Plan\n")
	q := openTestQueries(t)
	planPath := filepath.Join(dir, "plan.md")

	// Set name first
	if err := SetPlanName(q, planPath, "Keep This Name"); err != nil {
		t.Fatalf("SetPlanName: %v", err)
	}

	// Set meta (should not touch friendly_name)
	if err := SetPlanMeta(q, planPath, PlanMeta{Tags: []string{"x"}}); err != nil {
		t.Fatalf("SetPlanMeta: %v", err)
	}

	plans, _ := readPlansFrom(dir)
	enrichPlansFromDB(q, plans)
	if plans[0].Name != "Keep This Name" {
		t.Errorf("SetPlanMeta clobbered Name: got %q", plans[0].Name)
	}
}

func TestReadPlans_PinnedFirst(t *testing.T) {
	dir := t.TempDir()
	q := openTestQueries(t)

	now := time.Now()
	for _, name := range []string{"a.md", "b.md", "c.md"} {
		p := filepath.Join(dir, name)
		os.WriteFile(p, []byte("# "+name), 0o600)
		os.Chtimes(p, now, now)
	}

	pathB := filepath.Join(dir, "b.md")
	SetPlanMeta(q, pathB, PlanMeta{Pinned: true})

	plans, _ := readPlansFrom(dir)
	enrichPlansFromDB(q, plans)

	// Verify b is marked pinned; sort is applied by ReadPlans (not testable here directly)
	for _, p := range plans {
		if p.Filename == "b" && !p.Pinned {
			t.Errorf("plan b should be pinned")
		}
		if p.Filename != "b" && p.Pinned {
			t.Errorf("plan %q should not be pinned", p.Filename)
		}
	}
}
