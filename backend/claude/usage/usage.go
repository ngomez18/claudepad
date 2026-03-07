package usage

import (
	"encoding/json"
	"os"
	"path/filepath"
)

// ReadStatsCache reads and parses ~/.claude/stats-cache.json.
func ReadStatsCache() (*StatsCache, error) {
	home, err := os.UserHomeDir()
	if err != nil {
		return nil, err
	}
	return readStatsCacheFrom(filepath.Join(home, ".claude", "stats-cache.json"))
}

func readStatsCacheFrom(path string) (*StatsCache, error) {
	data, err := os.ReadFile(path)
	if err != nil {
		return nil, err
	}

	var stats StatsCache
	if err := json.Unmarshal(data, &stats); err != nil {
		return nil, err
	}

	return &stats, nil
}
