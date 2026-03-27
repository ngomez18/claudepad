package skills

import (
	"fmt"
	"os"
	"path/filepath"
	"sort"
	"time"

	"claudepad/backend/frontmatter"
)

// ReadSkills reads skill directories from ~/.claude/skills/ (global) and,
// if projectPath is non-empty, from <projectPath>/.claude/skills/ (project).
// Results are merged and sorted newest-first.
func ReadSkills(projectPath string) ([]Skill, error) {
	home, err := os.UserHomeDir()
	if err != nil {
		return nil, err
	}

	global, err := readSkillsFrom(filepath.Join(home, ".claude", "skills"), "global")
	if err != nil {
		return nil, err
	}

	if projectPath == "" {
		return global, nil
	}

	project, err := readSkillsFrom(filepath.Join(projectPath, ".claude", "skills"), "project")
	if err != nil {
		return nil, err
	}

	merged := append(global, project...)
	sort.Slice(merged, func(i, j int) bool {
		return merged[i].ModifiedAt > merged[j].ModifiedAt
	})
	return merged, nil
}

// WriteSkill writes content to the given SKILL.md path.
// The path must end in SKILL.md and reside inside a skills directory.
func WriteSkill(path, content string) error {
	if filepath.Base(path) != "SKILL.md" {
		return fmt.Errorf("path must point to a SKILL.md file")
	}
	return os.WriteFile(path, []byte(content), 0o644)
}

func readSkillsFrom(dir, scope string) ([]Skill, error) {
	entries, err := os.ReadDir(dir)
	if err != nil {
		if os.IsNotExist(err) {
			return []Skill{}, nil
		}
		return nil, err
	}

	var skillList []Skill
	for _, e := range entries {
		dirPath := filepath.Join(dir, e.Name())

		// Resolve symlinks to find the real path.
		realPath, err := filepath.EvalSymlinks(dirPath)
		if err != nil {
			realPath = dirPath
		}

		// Skip non-directories (follow symlinks with os.Stat).
		info, err := os.Stat(realPath)
		if err != nil || !info.IsDir() {
			continue
		}

		skillMDPath := filepath.Join(realPath, "SKILL.md")
		data, err := os.ReadFile(skillMDPath)

		var content, modifiedAt string
		if err == nil {
			content = string(data)
			if info, statErr := os.Stat(skillMDPath); statErr == nil {
				modifiedAt = info.ModTime().UTC().Format(time.RFC3339)
			}
		} else {
			// SKILL.md missing — use directory mtime
			if info, statErr := os.Stat(realPath); statErr == nil {
				modifiedAt = info.ModTime().UTC().Format(time.RFC3339)
			}
		}

		name, description := frontmatter.Parse(content)
		if name == "" {
			name = e.Name()
		}
		if description == "" && content != "" {
			description = frontmatter.FirstContentLine(content)
		}

		skillList = append(skillList, Skill{
			Path:        skillMDPath,
			DirName:     e.Name(),
			Name:        name,
			Description: description,
			Content:     content,
			ModifiedAt:  modifiedAt,
			Scope:       scope,
		})
	}

	sort.Slice(skillList, func(i, j int) bool {
		return skillList[i].ModifiedAt > skillList[j].ModifiedAt
	})

	return skillList, nil
}

