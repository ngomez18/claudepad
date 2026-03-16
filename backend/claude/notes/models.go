package notes

// Note represents a single note file in ~/.claudepad/notes/.
type Note struct {
	Path       string   `json:"path"`
	Filename   string   `json:"filename"`
	Title      string   `json:"title"`      // from frontmatter or DB, else filename-derived
	Content    string   `json:"content"`    // raw markdown body (after frontmatter)
	Project    string   `json:"project"`    // from frontmatter
	ModifiedAt string   `json:"modifiedAt"` // RFC3339 UTC
	WordCount  int      `json:"wordCount"`
	Tags       []string `json:"tags"`
	Pinned     bool     `json:"pinned"`
	Notes      string   `json:"notes"`    // private annotations
	Archived   bool     `json:"archived"`
}

// NoteMeta holds all mutable metadata for a note stored in SQLite.
type NoteMeta struct {
	Tags     []string `json:"tags"`
	Pinned   bool     `json:"pinned"`
	Notes    string   `json:"notes"`
	Archived bool     `json:"archived"`
}
