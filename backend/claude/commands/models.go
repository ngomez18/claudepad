package commands

// Command represents a single markdown command file from a commands directory.
type Command struct {
	Path        string `json:"path"`        // absolute path to .md file
	Filename    string `json:"filename"`    // base name without .md
	Name        string `json:"name"`        // from frontmatter, else Filename
	Description string `json:"description"` // from frontmatter, else first content line
	Content     string `json:"content"`     // full markdown content
	ModifiedAt  string `json:"modifiedAt"`  // RFC3339
	Scope       string `json:"scope"`       // "global" or "project"
}
