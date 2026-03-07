package plans

// Plan represents a single markdown plan file from ~/.claude/plans/.
type Plan struct {
	Path       string `json:"path"`
	Filename   string `json:"filename"`   // base name without .md extension
	Content    string `json:"content"`    // full markdown content
	TodoTotal  int    `json:"todoTotal"`  // total checkbox count
	TodoDone   int    `json:"todoDone"`   // completed checkbox count
	ModifiedAt string `json:"modifiedAt"` // RFC3339
}
