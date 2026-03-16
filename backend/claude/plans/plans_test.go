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

func TestSortPlans_PinnedBeforeUnpinned(t *testing.T) {
	plans := []Plan{
		{Filename: "a", ModifiedAt: "2024-01-03T00:00:00Z", Pinned: false},
		{Filename: "b", ModifiedAt: "2024-01-01T00:00:00Z", Pinned: true},
		{Filename: "c", ModifiedAt: "2024-01-02T00:00:00Z", Pinned: false},
	}
	sortPlans(plans)

	if plans[0].Filename != "b" {
		t.Errorf("expected pinned plan first, got %q", plans[0].Filename)
	}
	// Among unpinned, newer first
	if plans[1].Filename != "a" {
		t.Errorf("expected newest unpinned second, got %q", plans[1].Filename)
	}
	if plans[2].Filename != "c" {
		t.Errorf("expected oldest unpinned last, got %q", plans[2].Filename)
	}
}

func TestSortPlans_MultiplePinnedByMtime(t *testing.T) {
	plans := []Plan{
		{Filename: "old-pin", ModifiedAt: "2024-01-01T00:00:00Z", Pinned: true},
		{Filename: "new-pin", ModifiedAt: "2024-01-03T00:00:00Z", Pinned: true},
	}
	sortPlans(plans)

	if plans[0].Filename != "new-pin" {
		t.Errorf("expected newer pinned plan first, got %q", plans[0].Filename)
	}
}

func TestPlanFromContent_TodoCounts(t *testing.T) {
	content := "# Plan\n\n- [x] Done\n- [X] Also done\n- [ ] Pending\n"
	p := planFromContent("/some/path.md", "my-plan", content, time.Now())

	if p.TodoDone != 2 {
		t.Errorf("TodoDone: got %d, want 2", p.TodoDone)
	}
	if p.TodoTotal != 3 {
		t.Errorf("TodoTotal: got %d, want 3", p.TodoTotal)
	}
}

func TestPlanFromContent_WordCount(t *testing.T) {
	content := "hello world foo bar"
	p := planFromContent("/path.md", "plan", content, time.Now())
	if p.WordCount != 4 {
		t.Errorf("WordCount: got %d, want 4", p.WordCount)
	}
}

func TestPlanFromContent_Fields(t *testing.T) {
	now := time.Date(2024, 6, 1, 12, 0, 0, 0, time.UTC)
	p := planFromContent("/foo/bar.md", "bar", "content", now)

	if p.Path != "/foo/bar.md" {
		t.Errorf("Path: got %q", p.Path)
	}
	if p.Filename != "bar" {
		t.Errorf("Filename: got %q", p.Filename)
	}
	if p.Content != "content" {
		t.Errorf("Content: got %q", p.Content)
	}
	if p.ModifiedAt != "2024-06-01T12:00:00Z" {
		t.Errorf("ModifiedAt: got %q", p.ModifiedAt)
	}
	if p.Tags == nil {
		t.Error("Tags should be non-nil empty slice")
	}
}

// ── SyncToPreserved ───────────────────────────────────────────────────────────

func TestSyncToPreservedDir_CreatesFiles(t *testing.T) {
	dest := t.TempDir()
	plans := []Plan{
		{Filename: "alpha", Content: "# Alpha\n"},
		{Filename: "beta", Content: "# Beta\n"},
	}

	if err := syncToPreservedDir(plans, dest); err != nil {
		t.Fatalf("syncToPreservedDir: %v", err)
	}

	for _, p := range plans {
		got, err := os.ReadFile(filepath.Join(dest, p.Filename+".md"))
		if err != nil {
			t.Errorf("expected file %s.md: %v", p.Filename, err)
			continue
		}
		if string(got) != p.Content {
			t.Errorf("%s.md content: got %q, want %q", p.Filename, got, p.Content)
		}
	}
}

func TestSyncToPreservedDir_UpdatesChangedContent(t *testing.T) {
	dest := t.TempDir()
	path := filepath.Join(dest, "plan.md")
	os.WriteFile(path, []byte("old content"), 0o600)

	plans := []Plan{{Filename: "plan", Content: "new content"}}
	if err := syncToPreservedDir(plans, dest); err != nil {
		t.Fatalf("syncToPreservedDir: %v", err)
	}

	got, _ := os.ReadFile(path)
	if string(got) != "new content" {
		t.Errorf("expected updated content, got %q", got)
	}
}

func TestSyncToPreservedDir_SkipsUnchanged(t *testing.T) {
	dest := t.TempDir()
	path := filepath.Join(dest, "plan.md")
	os.WriteFile(path, []byte("same content"), 0o600)

	info1, _ := os.Stat(path)
	mtime1 := info1.ModTime()

	// Small sleep to ensure mtime would differ if file is rewritten
	time.Sleep(10 * time.Millisecond)

	plans := []Plan{{Filename: "plan", Content: "same content"}}
	if err := syncToPreservedDir(plans, dest); err != nil {
		t.Fatalf("syncToPreservedDir: %v", err)
	}

	info2, _ := os.Stat(path)
	if !info2.ModTime().Equal(mtime1) {
		t.Error("file was rewritten despite identical content")
	}
}

func TestSyncToPreservedDir_EmptyList(t *testing.T) {
	dest := t.TempDir()
	if err := syncToPreservedDir(nil, dest); err != nil {
		t.Fatalf("unexpected error with empty list: %v", err)
	}
}

// ── ReadPreservedPlans ────────────────────────────────────────────────────────

func TestReadPreservedPlansFrom_EmptyDir(t *testing.T) {
	q := openTestQueries(t)
	got, err := readPreservedPlansFrom(q, nil, t.TempDir())
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
	if len(got) != 0 {
		t.Errorf("expected 0 plans, got %d", len(got))
	}
}

func TestReadPreservedPlansFrom_DirNotExist(t *testing.T) {
	q := openTestQueries(t)
	got, err := readPreservedPlansFrom(q, nil, filepath.Join(t.TempDir(), "missing"))
	if err != nil {
		t.Fatalf("expected no error for missing dir, got: %v", err)
	}
	if got != nil {
		t.Errorf("expected nil, got %v", got)
	}
}

func TestReadPreservedPlansFrom_SetsPreservedFlag(t *testing.T) {
	dir := t.TempDir()
	q := openTestQueries(t)
	os.WriteFile(filepath.Join(dir, "ghost.md"), []byte("# Ghost\n"), 0o600)

	got, err := readPreservedPlansFrom(q, nil, dir)
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
	if len(got) != 1 {
		t.Fatalf("expected 1 plan, got %d", len(got))
	}
	if !got[0].Preserved {
		t.Error("expected Preserved=true")
	}
	if got[0].Filename != "ghost" {
		t.Errorf("Filename: got %q, want %q", got[0].Filename, "ghost")
	}
}

func TestReadPreservedPlansFrom_ExcludesLivePlans(t *testing.T) {
	dir := t.TempDir()
	q := openTestQueries(t)
	os.WriteFile(filepath.Join(dir, "live.md"), []byte("# Live\n"), 0o600)
	os.WriteFile(filepath.Join(dir, "ghost.md"), []byte("# Ghost\n"), 0o600)

	// Simulate "live.md" still being present in ~/.claude/plans/ by providing
	// its canonical path in the live set.
	home, _ := os.UserHomeDir()
	liveCanonical := filepath.Join(home, ".claude", "plans", "live.md")
	livePlans := []Plan{{Path: liveCanonical}}

	got, err := readPreservedPlansFrom(q, livePlans, dir)
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
	if len(got) != 1 {
		t.Fatalf("expected 1 preserved plan, got %d", len(got))
	}
	if got[0].Filename != "ghost" {
		t.Errorf("expected ghost.md, got %q", got[0].Filename)
	}
}

func TestReadPreservedPlansFrom_SkipsNonMarkdown(t *testing.T) {
	dir := t.TempDir()
	q := openTestQueries(t)
	os.WriteFile(filepath.Join(dir, "plan.md"), []byte("# Plan\n"), 0o600)
	os.WriteFile(filepath.Join(dir, "notes.txt"), []byte("ignore"), 0o600)
	os.Mkdir(filepath.Join(dir, "subdir"), 0o700)

	got, err := readPreservedPlansFrom(q, nil, dir)
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
	if len(got) != 1 {
		t.Errorf("expected 1 plan, got %d", len(got))
	}
}

func TestReadPreservedPlansFrom_CanonicalPathSet(t *testing.T) {
	dir := t.TempDir()
	q := openTestQueries(t)
	os.WriteFile(filepath.Join(dir, "my-plan.md"), []byte("# Plan\n"), 0o600)

	home, _ := os.UserHomeDir()
	expected := filepath.Join(home, ".claude", "plans", "my-plan.md")

	got, _ := readPreservedPlansFrom(q, nil, dir)
	if len(got) == 0 {
		t.Fatal("expected 1 plan")
	}
	if got[0].Path != expected {
		t.Errorf("Path: got %q, want %q", got[0].Path, expected)
	}
}

func TestReadPreservedPlansFrom_EnrichesFromDB(t *testing.T) {
	dir := t.TempDir()
	q := openTestQueries(t)
	os.WriteFile(filepath.Join(dir, "plan.md"), []byte("# Plan\n"), 0o600)

	// The DB key must match the canonical path that readPreservedPlansFrom will use.
	home, _ := os.UserHomeDir()
	canonical := filepath.Join(home, ".claude", "plans", "plan.md")
	SetPlanName(q, canonical, "My Friendly Name")

	got, err := readPreservedPlansFrom(q, nil, dir)
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
	if len(got) == 0 {
		t.Fatal("expected 1 plan")
	}
	if got[0].Name != "My Friendly Name" {
		t.Errorf("Name: got %q, want %q", got[0].Name, "My Friendly Name")
	}
}
