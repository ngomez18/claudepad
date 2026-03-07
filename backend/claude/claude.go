package claude

import (
	"context"
	"os"
	"path/filepath"

	"claudepad/backend/claude/usage"
	fswatch "claudepad/backend/fs"
)

// Re-export sub-package types so app.go only needs this package.
type StatsCache = usage.StatsCache

// Client provides access to Claude Code's local data files.
// It owns the file watcher and all path resolution — callers never touch paths directly.
type Client struct {
	watcher *fswatch.Watcher
}

func New() *Client {
	return &Client{}
}

// Start initialises the file watcher. emit is called with an event name whenever
// a watched file changes; pass runtime.EventsEmit or equivalent.
func (c *Client) Start(_ context.Context, emit func(event string)) error {
	w, err := fswatch.NewWatcher()
	if err != nil {
		return err
	}
	c.watcher = w
	return c.registerWatches(emit)
}

// Stop shuts down the file watcher.
func (c *Client) Stop() {
	if c.watcher != nil {
		c.watcher.Close()
	}
}

// registerWatches sets up all file watches for the current project set.
// Called once on Start; will be called again when projects are added/removed.
func (c *Client) registerWatches(emit func(string)) error {
	home, err := os.UserHomeDir()
	if err != nil {
		return err
	}
	globalDir := filepath.Join(home, ".claude")

	return c.watcher.Watch(
		filepath.Join(globalDir, "stats-cache.json"),
		func() { emit("usage:stats-updated") },
	)
}

func (c *Client) GetUsageStats() (*StatsCache, error) {
	return usage.ReadStatsCache()
}
