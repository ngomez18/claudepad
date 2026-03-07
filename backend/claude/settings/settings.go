package settings

import (
	"encoding/json"
	"fmt"
	"os"
	"path/filepath"
)

// ReadSettings returns settings files for the global and optionally project layer.
// If a file doesn't exist, returns a SettingsFile with Exists=false and Content="{}".
// projectPath is the real filesystem path of the project; pass empty string to skip project layer.
func ReadSettings(projectPath string) ([]SettingsFile, error) {
	home, err := os.UserHomeDir()
	if err != nil {
		return nil, err
	}

	globalPath := filepath.Join(home, ".claude", "settings.json")
	result := []SettingsFile{readSettingsFrom(globalPath, "global")}

	if projectPath != "" {
		projectSettingsPath := filepath.Join(projectPath, ".claude", "settings.json")
		localSettingsPath := filepath.Join(projectPath, ".claude", "settings.local.json")
		result = append(result,
			readSettingsFrom(projectSettingsPath, "project"),
			readSettingsFrom(localSettingsPath, "local"),
		)
	}

	return result, nil
}

// WriteSettings validates content as JSON then writes it to path, creating parent dirs as needed.
func WriteSettings(path, content string) error {
	if !json.Valid([]byte(content)) {
		return fmt.Errorf("invalid JSON")
	}
	if err := os.MkdirAll(filepath.Dir(path), 0o755); err != nil {
		return err
	}
	return os.WriteFile(path, []byte(content), 0o644)
}

func readSettingsFrom(path, layer string) SettingsFile {
	data, err := os.ReadFile(path)
	if err != nil {
		return SettingsFile{Layer: layer, Path: path, Content: "{}", Exists: false}
	}
	return SettingsFile{Layer: layer, Path: path, Content: string(data), Exists: true}
}
