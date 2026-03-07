package skills

import (
	"os"
	"path/filepath"
	"testing"
)

func TestReadSkillsFrom_WithFrontmatter(t *testing.T) {
	dir := t.TempDir()
	skillDir := filepath.Join(dir, "dev-journal")
	if err := os.Mkdir(skillDir, 0o755); err != nil {
		t.Fatal(err)
	}
	content := "---\nname: dev-journal\ndescription: Track development work\nallowed-tools: Bash Read Write\n---\nSkill instructions here.\n"
	if err := os.WriteFile(filepath.Join(skillDir, "SKILL.md"), []byte(content), 0o644); err != nil {
		t.Fatal(err)
	}

	list, err := readSkillsFrom(dir, "global")
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
	if len(list) != 1 {
		t.Fatalf("expected 1 skill, got %d", len(list))
	}
	if list[0].Name != "dev-journal" {
		t.Errorf("expected name 'dev-journal', got %q", list[0].Name)
	}
	if list[0].Description != "Track development work" {
		t.Errorf("expected description 'Track development work', got %q", list[0].Description)
	}
	if list[0].DirName != "dev-journal" {
		t.Errorf("expected dirName 'dev-journal', got %q", list[0].DirName)
	}
	if list[0].Scope != "global" {
		t.Errorf("expected scope 'global', got %q", list[0].Scope)
	}
}

func TestReadSkills_MergesScopes(t *testing.T) {
	fakeHome := t.TempDir()
	projectDir := t.TempDir()

	globalSkillsDir := filepath.Join(fakeHome, ".claude", "skills", "global-skill")
	projectSkillsDir := filepath.Join(projectDir, ".claude", "skills", "project-skill")
	if err := os.MkdirAll(globalSkillsDir, 0o755); err != nil {
		t.Fatal(err)
	}
	if err := os.MkdirAll(projectSkillsDir, 0o755); err != nil {
		t.Fatal(err)
	}
	_ = os.WriteFile(filepath.Join(globalSkillsDir, "SKILL.md"), []byte("global skill"), 0o644)
	_ = os.WriteFile(filepath.Join(projectSkillsDir, "SKILL.md"), []byte("project skill"), 0o644)

	global, _ := readSkillsFrom(filepath.Join(fakeHome, ".claude", "skills"), "global")
	project, _ := readSkillsFrom(filepath.Join(projectDir, ".claude", "skills"), "project")
	all := append(global, project...)

	if len(all) != 2 {
		t.Fatalf("expected 2 skills, got %d", len(all))
	}
	scopes := map[string]bool{}
	for _, s := range all {
		scopes[s.Scope] = true
	}
	if !scopes["global"] || !scopes["project"] {
		t.Errorf("expected both scopes, got %v", scopes)
	}
}

func TestReadSkillsFrom_MissingSkillMD(t *testing.T) {
	dir := t.TempDir()
	skillDir := filepath.Join(dir, "empty-skill")
	if err := os.Mkdir(skillDir, 0o755); err != nil {
		t.Fatal(err)
	}

	list, err := readSkillsFrom(dir, "global")
	if err != nil {
		t.Fatal(err)
	}
	if len(list) != 1 {
		t.Fatalf("expected 1 skill, got %d", len(list))
	}
	if list[0].Name != "empty-skill" {
		t.Errorf("expected name 'empty-skill', got %q", list[0].Name)
	}
	if list[0].Content != "" {
		t.Errorf("expected empty content, got %q", list[0].Content)
	}
}

func TestReadSkillsFrom_SymlinkedDir(t *testing.T) {
	dir := t.TempDir()
	realSkillDir := t.TempDir()

	content := "---\nname: symlinked\ndescription: A symlinked skill\n---\nContent.\n"
	if err := os.WriteFile(filepath.Join(realSkillDir, "SKILL.md"), []byte(content), 0o644); err != nil {
		t.Fatal(err)
	}

	linkPath := filepath.Join(dir, "symlinked-skill")
	if err := os.Symlink(realSkillDir, linkPath); err != nil {
		t.Skip("symlinks not supported:", err)
	}

	list, err := readSkillsFrom(dir, "global")
	if err != nil {
		t.Fatal(err)
	}
	if len(list) != 1 {
		t.Fatalf("expected 1 skill, got %d", len(list))
	}
	if list[0].Name != "symlinked" {
		t.Errorf("expected name 'symlinked', got %q", list[0].Name)
	}
}

func TestReadSkillsFrom_SkipsFiles(t *testing.T) {
	dir := t.TempDir()
	_ = os.WriteFile(filepath.Join(dir, "not-a-skill.md"), []byte("content"), 0o644)
	skillDir := filepath.Join(dir, "real-skill")
	_ = os.Mkdir(skillDir, 0o755)
	_ = os.WriteFile(filepath.Join(skillDir, "SKILL.md"), []byte("content"), 0o644)

	list, err := readSkillsFrom(dir, "global")
	if err != nil {
		t.Fatal(err)
	}
	if len(list) != 1 {
		t.Errorf("expected 1 skill (files skipped), got %d", len(list))
	}
}

func TestReadSkillsFrom_EmptyDir(t *testing.T) {
	dir := t.TempDir()
	list, err := readSkillsFrom(dir, "global")
	if err != nil {
		t.Fatal(err)
	}
	if len(list) != 0 {
		t.Errorf("expected 0 skills, got %d", len(list))
	}
}
