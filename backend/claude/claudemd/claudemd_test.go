package claudemd

import (
	"os"
	"path/filepath"
	"testing"
)

func TestReadFrom_Exists(t *testing.T) {
	dir := t.TempDir()
	path := filepath.Join(dir, "CLAUDE.md")
	content := "# Instructions\n\nDo great things."
	if err := os.WriteFile(path, []byte(content), 0o644); err != nil {
		t.Fatal(err)
	}

	f := readFrom(path, "global")
	if !f.Exists {
		t.Error("expected Exists=true")
	}
	if f.Content != content {
		t.Errorf("expected %q got %q", content, f.Content)
	}
	if f.Layer != "global" {
		t.Errorf("expected layer global, got %q", f.Layer)
	}
}

func TestReadFrom_Missing(t *testing.T) {
	f := readFrom("/nonexistent/CLAUDE.md", "global")
	if f.Exists {
		t.Error("expected Exists=false for missing file")
	}
	if f.Content != "" {
		t.Errorf("expected empty content, got %q", f.Content)
	}
}

func TestWrite_CreatesFile(t *testing.T) {
	dir := t.TempDir()
	path := filepath.Join(dir, "sub", "CLAUDE.md")
	content := "# My Instructions"

	if err := Write(path, content); err != nil {
		t.Fatalf("unexpected error: %v", err)
	}

	data, err := os.ReadFile(path)
	if err != nil {
		t.Fatal(err)
	}
	if string(data) != content {
		t.Errorf("expected %q got %q", content, string(data))
	}
}

func TestWrite_UpdatesExistingFile(t *testing.T) {
	dir := t.TempDir()
	path := filepath.Join(dir, "CLAUDE.md")
	_ = os.WriteFile(path, []byte("old content"), 0o644)

	if err := Write(path, "new content"); err != nil {
		t.Fatalf("unexpected error: %v", err)
	}

	data, _ := os.ReadFile(path)
	if string(data) != "new content" {
		t.Errorf("expected new content, got %q", string(data))
	}
}

func TestRead_GlobalOnly(t *testing.T) {
	// Test the helper directly since Read uses os.UserHomeDir.
	dir := t.TempDir()
	globalPath := filepath.Join(dir, "CLAUDE.md")
	_ = os.WriteFile(globalPath, []byte("# Global"), 0o644)

	f := readFrom(globalPath, "global")
	if !f.Exists {
		t.Error("expected global CLAUDE.md to exist")
	}
	if f.Layer != "global" {
		t.Errorf("expected layer=global, got %q", f.Layer)
	}
}

func TestRead_ProjectLayer(t *testing.T) {
	dir := t.TempDir()
	projectPath := filepath.Join(dir, "myproject")
	if err := os.MkdirAll(projectPath, 0o755); err != nil {
		t.Fatal(err)
	}
	mdPath := filepath.Join(projectPath, "CLAUDE.md")
	content := "# Project Instructions"
	if err := os.WriteFile(mdPath, []byte(content), 0o644); err != nil {
		t.Fatal(err)
	}

	f := readFrom(mdPath, "project")
	if !f.Exists {
		t.Error("expected project CLAUDE.md to exist")
	}
	if f.Content != content {
		t.Errorf("expected %q, got %q", content, f.Content)
	}
}
