package projects

// Project represents a registered Claude Code project.
type Project struct {
	ID          string `json:"id"`
	Name        string `json:"name"`
	RealPath    string `json:"real_path"`
	IsGlobal    bool   `json:"is_global"`
	EncodedName string `json:"encoded_name"`
	LastOpened  string `json:"last_opened"`
	CreatedAt   string `json:"created_at"`
}
