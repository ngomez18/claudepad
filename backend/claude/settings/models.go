package settings

type SettingsFile struct {
	Layer   string `json:"layer"`   // "global" | "project"
	Path    string `json:"path"`    // absolute path to settings.json
	Content string `json:"content"` // raw JSON (empty string if file absent)
	Exists  bool   `json:"exists"`
}

// McpServerConfig represents a single MCP server entry in ~/.claude.json.
type McpServerConfig struct {
	Type    string            `json:"type"`              // "stdio" | "sse" | "http"
	Command string            `json:"command,omitempty"` // for stdio
	Args    []string          `json:"args,omitempty"`
	URL     string            `json:"url,omitempty"`     // for sse/http
	Headers map[string]string `json:"headers,omitempty"`
}
