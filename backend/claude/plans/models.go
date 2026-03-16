package plans

// PlanMeta holds all mutable metadata stored in SQLite for a plan.
// It is the argument type for SetPlanMeta. Name is set separately via SetPlanName.
type PlanMeta struct {
	Pinned    bool     `json:"pinned"`
	ProjectID string   `json:"projectId"` // projects.id or ""
	Tags      []string `json:"tags"`
	Notes     string   `json:"notes"`
	Archived  bool     `json:"archived"`
}

// Plan represents a single markdown plan file from ~/.claude/plans/.
type Plan struct {
	Path       string   `json:"path"`
	Filename   string   `json:"filename"`  // base name without .md extension
	Name       string   `json:"name"`      // friendly name from DB; empty = use Filename
	Content    string   `json:"content"`   // full markdown content
	TodoTotal  int      `json:"todoTotal"` // total checkbox count
	TodoDone   int      `json:"todoDone"`  // completed checkbox count
	ModifiedAt string   `json:"modifiedAt"` // RFC3339
	WordCount  int      `json:"wordCount"`
	// metadata fields (from file_metadata table)
	Pinned    bool     `json:"pinned"`
	ProjectID string   `json:"projectId"`
	Tags      []string `json:"tags"`
	Notes     string   `json:"notes"`
	Archived  bool     `json:"archived"`
	Preserved bool     `json:"preserved"` // true when plan is in ~/.claudepad/plans/ but not ~/.claude/plans/
}
