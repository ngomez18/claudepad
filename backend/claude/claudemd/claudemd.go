package claudemd

import (
	"os"
	"path/filepath"
)

// Read returns CLAUDE.md files for the global layer and optionally the project layer.
// If a file doesn't exist, returns a ClaudeMdFile with Exists=false and Content="".
// projectPath is the real filesystem path of the project root; pass empty string to skip project layer.
func Read(projectPath string) ([]ClaudeMdFile, error) {
	home, err := os.UserHomeDir()
	if err != nil {
		return nil, err
	}

	globalPath := filepath.Join(home, ".claude", "CLAUDE.md")
	result := []ClaudeMdFile{readFrom(globalPath, "global")}

	if projectPath != "" {
		projectMdPath := filepath.Join(projectPath, "CLAUDE.md")
		result = append(result, readFrom(projectMdPath, "project"))
	}

	return result, nil
}

// Write saves content to the given CLAUDE.md path, creating parent dirs as needed.
func Write(path, content string) error {
	if err := os.MkdirAll(filepath.Dir(path), 0o755); err != nil {
		return err
	}
	return os.WriteFile(path, []byte(content), 0o644)
}

func readFrom(path, layer string) ClaudeMdFile {
	data, err := os.ReadFile(path)
	if err != nil {
		return ClaudeMdFile{Layer: layer, Path: path, Content: "", Exists: false}
	}
	return ClaudeMdFile{Layer: layer, Path: path, Content: string(data), Exists: true}
}
