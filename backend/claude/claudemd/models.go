package claudemd

// ClaudeMdFile represents a CLAUDE.md file at a specific layer.
type ClaudeMdFile struct {
	Layer   string `json:"layer"`   // "global" | "project"
	Path    string `json:"path"`    // absolute path to CLAUDE.md
	Content string `json:"content"` // raw markdown (empty string if file absent)
	Exists  bool   `json:"exists"`
}
