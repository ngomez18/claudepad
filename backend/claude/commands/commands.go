package commands

import (
	"fmt"
	"os"
	"path/filepath"
	"sort"
	"strings"
	"time"

	"claudepad/backend/frontmatter"
)

// ReadCommands reads command files from ~/.claude/commands/ (global) and,
// if projectPath is non-empty, from <projectPath>/.claude/commands/ (project).
// Results are merged and sorted newest-first.
func ReadCommands(projectPath string) ([]Command, error) {
	home, err := os.UserHomeDir()
	if err != nil {
		return nil, err
	}

	global, err := readCommandsFrom(filepath.Join(home, ".claude", "commands"), "global")
	if err != nil {
		return nil, err
	}

	if projectPath == "" {
		return global, nil
	}

	project, err := readCommandsFrom(filepath.Join(projectPath, ".claude", "commands"), "project")
	if err != nil {
		return nil, err
	}

	merged := append(global, project...)
	sort.Slice(merged, func(i, j int) bool {
		return merged[i].ModifiedAt > merged[j].ModifiedAt
	})
	return merged, nil
}

func readCommandsFrom(dir, scope string) ([]Command, error) {
	entries, err := os.ReadDir(dir)
	if err != nil {
		if os.IsNotExist(err) {
			return []Command{}, nil
		}
		return nil, err
	}

	var cmds []Command
	for _, e := range entries {
		if e.IsDir() || !strings.HasSuffix(e.Name(), ".md") {
			continue
		}

		path := filepath.Join(dir, e.Name())
		data, err := os.ReadFile(path)
		if err != nil {
			continue
		}

		info, _ := e.Info()
		content := string(data)
		name, description := frontmatter.Parse(content)

		filename := strings.TrimSuffix(e.Name(), ".md")
		if name == "" {
			name = filename
		}
		if description == "" {
			description = frontmatter.FirstContentLine(content)
		}

		cmds = append(cmds, Command{
			Path:        path,
			Filename:    filename,
			Name:        name,
			Description: description,
			Content:     content,
			ModifiedAt:  info.ModTime().UTC().Format(time.RFC3339),
			Scope:       scope,
		})
	}

	return cmds, nil
}

// WriteCommand validates the path is inside a known commands directory then writes content.
// Allowed locations: ~/.claude/commands/ (global) or <any>/.claude/commands/ (project).
func WriteCommand(path, content string) error {
	clean := filepath.Clean(path)
	// Must be inside a directory named "commands" whose parent is ".claude".
	dir := filepath.Dir(clean)
	if filepath.Base(dir) != "commands" || filepath.Base(filepath.Dir(dir)) != ".claude" {
		return fmt.Errorf("path is not inside a .claude/commands directory")
	}
	return os.WriteFile(clean, []byte(content), 0o644)
}

