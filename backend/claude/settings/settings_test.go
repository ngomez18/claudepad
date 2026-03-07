package settings

import (
	"os"
	"path/filepath"
	"testing"
)

func TestReadSettingsFrom_Exists(t *testing.T) {
	dir := t.TempDir()
	path := filepath.Join(dir, "settings.json")
	content := `{"model":"claude-opus-4-6"}`
	if err := os.WriteFile(path, []byte(content), 0o644); err != nil {
		t.Fatal(err)
	}

	sf := readSettingsFrom(path, "global")
	if !sf.Exists {
		t.Error("expected Exists=true")
	}
	if sf.Content != content {
		t.Errorf("expected %q got %q", content, sf.Content)
	}
	if sf.Layer != "global" {
		t.Errorf("expected layer global, got %q", sf.Layer)
	}
}

func TestReadSettingsFrom_Missing(t *testing.T) {
	sf := readSettingsFrom("/nonexistent/settings.json", "global")
	if sf.Exists {
		t.Error("expected Exists=false for missing file")
	}
	if sf.Content != "{}" {
		t.Errorf("expected default content {}, got %q", sf.Content)
	}
}

func TestWriteSettings_ValidJSON(t *testing.T) {
	dir := t.TempDir()
	path := filepath.Join(dir, "sub", "settings.json")
	content := `{"model":"claude-sonnet-4-6"}`

	if err := WriteSettings(path, content); err != nil {
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

func TestWriteSettings_InvalidJSON(t *testing.T) {
	dir := t.TempDir()
	path := filepath.Join(dir, "settings.json")

	err := WriteSettings(path, `{invalid}`)
	if err == nil {
		t.Error("expected error for invalid JSON")
	}
}

func TestReadSettings_Global(t *testing.T) {
	dir := t.TempDir()
	globalPath := filepath.Join(dir, "settings.json")
	_ = os.WriteFile(globalPath, []byte(`{}`), 0o644)

	// We test the helpers directly since ReadSettings uses os.UserHomeDir.
	sf := readSettingsFrom(globalPath, "global")
	if !sf.Exists {
		t.Error("expected global settings to exist")
	}
}

func TestReadSettings_ProjectMissing(t *testing.T) {
	sf := readSettingsFrom("/no/such/path/.claude/settings.json", "project")
	if sf.Exists {
		t.Error("expected Exists=false")
	}
	if sf.Content != "{}" {
		t.Errorf("expected {}, got %q", sf.Content)
	}
}

func TestReadSettings_LocalLayer(t *testing.T) {
	dir := t.TempDir()
	claudeDir := filepath.Join(dir, ".claude")
	if err := os.MkdirAll(claudeDir, 0o755); err != nil {
		t.Fatal(err)
	}
	localPath := filepath.Join(claudeDir, "settings.local.json")
	content := `{"permissions":{"allow":["Bash(*)"]}}`
	if err := os.WriteFile(localPath, []byte(content), 0o644); err != nil {
		t.Fatal(err)
	}

	sf := readSettingsFrom(localPath, "local")
	if !sf.Exists {
		t.Error("expected Exists=true for local settings")
	}
	if sf.Layer != "local" {
		t.Errorf("expected layer=local, got %q", sf.Layer)
	}
	if sf.Content != content {
		t.Errorf("expected %q, got %q", content, sf.Content)
	}
}
