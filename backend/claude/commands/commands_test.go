package commands

import (
	"os"
	"path/filepath"
	"testing"
)

func TestReadCommandsFrom_WithFrontmatter(t *testing.T) {
	dir := t.TempDir()
	content := "---\nname: my-cmd\ndescription: Does a thing\n---\nBody content here.\n"
	if err := os.WriteFile(filepath.Join(dir, "my-cmd.md"), []byte(content), 0o644); err != nil {
		t.Fatal(err)
	}

	cmds, err := readCommandsFrom(dir, "global")
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
	if len(cmds) != 1 {
		t.Fatalf("expected 1 command, got %d", len(cmds))
	}
	if cmds[0].Name != "my-cmd" {
		t.Errorf("expected name 'my-cmd', got %q", cmds[0].Name)
	}
	if cmds[0].Description != "Does a thing" {
		t.Errorf("expected description 'Does a thing', got %q", cmds[0].Description)
	}
	if cmds[0].Filename != "my-cmd" {
		t.Errorf("expected filename 'my-cmd', got %q", cmds[0].Filename)
	}
	if cmds[0].Scope != "global" {
		t.Errorf("expected scope 'global', got %q", cmds[0].Scope)
	}
}

func TestReadCommands_MergesScopes(t *testing.T) {
	// Build fake home and project dirs
	fakeHome := t.TempDir()
	projectDir := t.TempDir()

	globalCmdsDir := filepath.Join(fakeHome, ".claude", "commands")
	projectCmdsDir := filepath.Join(projectDir, ".claude", "commands")
	if err := os.MkdirAll(globalCmdsDir, 0o755); err != nil {
		t.Fatal(err)
	}
	if err := os.MkdirAll(projectCmdsDir, 0o755); err != nil {
		t.Fatal(err)
	}

	_ = os.WriteFile(filepath.Join(globalCmdsDir, "global-cmd.md"), []byte("global content"), 0o644)
	_ = os.WriteFile(filepath.Join(projectCmdsDir, "project-cmd.md"), []byte("project content"), 0o644)

	global, _ := readCommandsFrom(globalCmdsDir, "global")
	project, _ := readCommandsFrom(projectCmdsDir, "project")
	all := append(global, project...)

	if len(all) != 2 {
		t.Fatalf("expected 2 commands, got %d", len(all))
	}
	scopes := map[string]bool{}
	for _, c := range all {
		scopes[c.Scope] = true
	}
	if !scopes["global"] || !scopes["project"] {
		t.Errorf("expected both scopes, got %v", scopes)
	}
}

func TestReadCommandsFrom_NoFrontmatter(t *testing.T) {
	dir := t.TempDir()
	content := "This is the first line.\nSecond line.\n"
	if err := os.WriteFile(filepath.Join(dir, "simple.md"), []byte(content), 0o644); err != nil {
		t.Fatal(err)
	}

	cmds, err := readCommandsFrom(dir, "global")
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
	if len(cmds) != 1 {
		t.Fatalf("expected 1 command, got %d", len(cmds))
	}
	if cmds[0].Name != "simple" {
		t.Errorf("expected name 'simple', got %q", cmds[0].Name)
	}
	if cmds[0].Description != "This is the first line." {
		t.Errorf("expected description from first line, got %q", cmds[0].Description)
	}
}

func TestReadCommandsFrom_SkipsNonMD(t *testing.T) {
	dir := t.TempDir()
	_ = os.WriteFile(filepath.Join(dir, "ignore.txt"), []byte("txt"), 0o644)
	_ = os.Mkdir(filepath.Join(dir, "subdir"), 0o755)
	_ = os.WriteFile(filepath.Join(dir, "keep.md"), []byte("content"), 0o644)

	cmds, err := readCommandsFrom(dir, "global")
	if err != nil {
		t.Fatal(err)
	}
	if len(cmds) != 1 {
		t.Errorf("expected 1 command, got %d", len(cmds))
	}
}

func TestReadCommandsFrom_EmptyDir(t *testing.T) {
	dir := t.TempDir()
	cmds, err := readCommandsFrom(dir, "global")
	if err != nil {
		t.Fatal(err)
	}
	if len(cmds) != 0 {
		t.Errorf("expected 0 commands, got %d", len(cmds))
	}
}

func TestReadCommandsFrom_MissingDir(t *testing.T) {
	cmds, err := readCommandsFrom("/nonexistent/path/commands", "global")
	if err != nil {
		t.Fatal(err)
	}
	if len(cmds) != 0 {
		t.Errorf("expected 0 commands, got %d", len(cmds))
	}
}
