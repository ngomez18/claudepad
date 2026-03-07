package sessions

// Session represents metadata for a single Claude Code session.
type Session struct {
	SessionID    string `json:"sessionId"`
	ProjectPath  string `json:"projectPath"`  // encoded dir name e.g. "-Users-ngomez-code-claudepad"
	Slug         string `json:"slug"`          // whimsical name, empty if not found
	GitBranch    string `json:"gitBranch"`
	Cwd          string `json:"cwd"`
	MessageCount int    `json:"messageCount"`  // user text turns only
	Snippet      string `json:"snippet"`       // first user text, truncated to 120 chars
	StartedAt    string `json:"startedAt"`     // RFC3339
	DurationSecs int    `json:"durationSecs"`
}

// TranscriptMessage is a single message in a session transcript.
type TranscriptMessage struct {
	Role      string   `json:"role"`      // "user" or "assistant"
	Text      string   `json:"text"`      // extracted plain text
	Tools     []string `json:"tools"`     // tool names used (assistant only)
	Timestamp string   `json:"timestamp"`
}
