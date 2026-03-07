package skills

// Skill represents a skill directory from a skills directory.
type Skill struct {
	Path        string `json:"path"`        // absolute path to SKILL.md
	DirName     string `json:"dirName"`     // directory entry name (slug)
	Name        string `json:"name"`        // from frontmatter, else DirName
	Description string `json:"description"` // from frontmatter, else first content line
	Content     string `json:"content"`     // full SKILL.md content
	ModifiedAt  string `json:"modifiedAt"`  // RFC3339 of SKILL.md mtime
	Scope       string `json:"scope"`       // "global" or "project"
}
