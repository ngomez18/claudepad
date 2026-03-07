package plans

import (
	"os"
	"path/filepath"
	"testing"
	"time"
)

func writePlan(t *testing.T, dir, name, content string) {
	t.Helper()
	if err := os.WriteFile(filepath.Join(dir, name), []byte(content), 0o600); err != nil {
		t.Fatalf("write plan: %v", err)
	}
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
