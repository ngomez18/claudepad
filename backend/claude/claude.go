package claude

import (
	"context"
	"os"
	"path/filepath"

	"claudepad/backend/claude/plans"
	"claudepad/backend/claude/sessions"
	"claudepad/backend/claude/usage"
	"claudepad/backend/db"
	fswatch "claudepad/backend/fs"
)

// Re-export sub-package types so app.go only needs this package.
type StatsCache = usage.StatsCache
type Plan = plans.Plan
type Session = sessions.Session
type TranscriptMessage = sessions.TranscriptMessage

// Client provides access to Claude Code's local data files.
// It owns the file watcher and all path resolution — callers never touch paths directly.
type Client struct {
	watcher *fswatch.Watcher
	db      *db.DB
}

func New() *Client {
	return &Client{}
}

// Start initialises the database and file watcher. emit is called with an event
// name whenever a watched file changes; pass runtime.EventsEmit or equivalent.
func (c *Client) Start(_ context.Context, emit func(event string)) error {
	home, err := os.UserHomeDir()
	if err != nil {
		return err
	}
	d, err := db.Open(filepath.Join(home, ".claudepad", "claudepad.db"))
	if err != nil {
		return err
	}
	c.db = d

	w, err := fswatch.NewWatcher()
	if err != nil {
		c.db.Close()
		return err
	}
	c.watcher = w
	return c.registerWatches(emit)
}

// Stop shuts down the file watcher and database connection.
func (c *Client) Stop() {
	if c.watcher != nil {
		c.watcher.Close()
	}
	if c.db != nil {
		c.db.Close()
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

	if err := c.watcher.Watch(
		filepath.Join(globalDir, "stats-cache.json"),
		func() { emit("usage:stats-updated") },
	); err != nil {
		return err
	}

	if err := c.watcher.WatchDir(
		filepath.Join(globalDir, "plans"),
		func() { emit("plans:updated") },
	); err != nil {
		return err
	}

	if err := c.watcher.WatchDir(
		filepath.Join(globalDir, "projects"),
		func() { emit("sessions:updated") },
	); err != nil {
		return err
	}

	return nil
}

func (c *Client) GetUsageStats() (*StatsCache, error) {
	return usage.ReadStatsCache()
}

func (c *Client) GetPlans() ([]Plan, error) {
	return plans.ReadPlans()
}

func (c *Client) GetSessions() ([]Session, error) {
	return sessions.ReadSessions()
}

func (c *Client) GetSessionTranscript(projectPath, sessionID string) ([]TranscriptMessage, error) {
	return sessions.ReadTranscript(projectPath, sessionID)
}
