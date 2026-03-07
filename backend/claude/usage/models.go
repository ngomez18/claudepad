package usage

// StatsCache mirrors ~/.claude/stats-cache.json (schema version 2).
type StatsCache struct {
	Version                     int                   `json:"version"`
	LastComputedDate            string                `json:"lastComputedDate"`
	DailyActivity               []DailyActivity       `json:"dailyActivity"`
	DailyModelTokens            []DailyModelTokens    `json:"dailyModelTokens"`
	ModelUsage                  map[string]ModelUsage `json:"modelUsage"`
	TotalSessions               int                   `json:"totalSessions"`
	TotalMessages               int                   `json:"totalMessages"`
	LongestSession              LongestSession        `json:"longestSession"`
	FirstSessionDate            string                `json:"firstSessionDate"`
	HourCounts                  map[string]int        `json:"hourCounts"`
	TotalSpeculationTimeSavedMs int64                 `json:"totalSpeculationTimeSavedMs"`
}

type DailyActivity struct {
	Date          string `json:"date"`
	MessageCount  int    `json:"messageCount"`
	SessionCount  int    `json:"sessionCount"`
	ToolCallCount int    `json:"toolCallCount"`
}

type DailyModelTokens struct {
	Date          string         `json:"date"`
	TokensByModel map[string]int `json:"tokensByModel"`
}

type ModelUsage struct {
	InputTokens              int     `json:"inputTokens"`
	OutputTokens             int     `json:"outputTokens"`
	CacheReadInputTokens     int     `json:"cacheReadInputTokens"`
	CacheCreationInputTokens int     `json:"cacheCreationInputTokens"`
	WebSearchRequests        int     `json:"webSearchRequests"`
	CostUSD                  float64 `json:"costUSD"`
	ContextWindow            int     `json:"contextWindow"`
	MaxOutputTokens          int     `json:"maxOutputTokens"`
}

type LongestSession struct {
	SessionID    string `json:"sessionId"`
	Duration     int64  `json:"duration"`
	MessageCount int    `json:"messageCount"`
	Timestamp    string `json:"timestamp"`
}
