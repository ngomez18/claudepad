package claude

import (
	"context"
	"os"
	"path/filepath"

	"claudepad/backend/claude/commands"
	"claudepad/backend/claude/plans"
	"claudepad/backend/claude/projects"
	"claudepad/backend/claude/sessions"
	"claudepad/backend/claude/settings"
	"claudepad/backend/claude/skills"
	"claudepad/backend/claude/usage"
	"claudepad/backend/db"
	fswatch "claudepad/backend/fs"
)

// Re-export sub-package types so app.go only needs this package.
type StatsCache = usage.StatsCache
type Plan = plans.Plan
type Session = sessions.Session
type TranscriptMessage = sessions.TranscriptMessage
type Project = projects.Project
type SettingsFile = settings.SettingsFile
type Skill = skills.Skill
type Command = commands.Command
type PlanMeta = plans.PlanMeta

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
	if err := c.registerWatches(emit); err != nil {
		return err
	}

	// Auto-discover projects from disk on startup (best-effort).
	go func() {
		claudeDir := filepath.Join(home, ".claude")
		q := c.db.Queries()
		discovered, err := projects.DiscoverProjects(q, claudeDir)
		if err != nil {
			return
		}
		for _, p := range discovered {
			_, _ = projects.AddProject(q, p.RealPath)
		}
		if len(discovered) > 0 {
			emit("projects:updated")
		}
	}()

	return nil
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

	if err := c.watcher.Watch(
		filepath.Join(globalDir, "settings.json"),
		func() { emit("settings:updated") },
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

	if err := c.watcher.WatchDir(
		filepath.Join(globalDir, "skills"),
		func() { emit("skills:updated") },
	); err != nil {
		return err
	}

	if err := c.watcher.WatchDir(
		filepath.Join(globalDir, "commands"),
		func() { emit("commands:updated") },
	); err != nil {
		return err
	}

	return nil
}

func (c *Client) GetUsageStats() (*StatsCache, error) {
	return usage.ReadStatsCache()
}

func (c *Client) GetPlans() ([]Plan, error) {
	return plans.ReadPlans(c.db.Queries())
}

func (c *Client) SetPlanName(path, name string) error {
	return plans.SetPlanName(c.db.Queries(), path, name)
}

func (c *Client) SetPlanMeta(path string, meta PlanMeta) error {
	return plans.SetPlanMeta(c.db.Queries(), path, meta)
}

func (c *Client) GetSessions() ([]Session, error) {
	return sessions.ReadSessions()
}

func (c *Client) GetSessionTranscript(projectPath, sessionID string) ([]TranscriptMessage, error) {
	return sessions.ReadTranscript(projectPath, sessionID)
}

func (c *Client) claudeDir() (string, error) {
	home, err := os.UserHomeDir()
	if err != nil {
		return "", err
	}
	return filepath.Join(home, ".claude"), nil
}

func (c *Client) GetProjects() ([]Project, error) {
	dir, err := c.claudeDir()
	if err != nil {
		return nil, err
	}
	return projects.ReadProjects(c.db.Queries(), dir)
}

func (c *Client) DiscoverProjects() ([]Project, error) {
	dir, err := c.claudeDir()
	if err != nil {
		return nil, err
	}
	return projects.DiscoverProjects(c.db.Queries(), dir)
}

func (c *Client) AddProject(path string) (Project, error) {
	return projects.AddProject(c.db.Queries(), path)
}

func (c *Client) RemoveProject(id string) error {
	return projects.RemoveProject(c.db.Queries(), id)
}

func (c *Client) SetProjectLastOpened(id string) error {
	return projects.UpdateLastOpened(c.db.Queries(), id)
}

func (c *Client) GetSettings(projectPath string) ([]SettingsFile, error) {
	return settings.ReadSettings(projectPath)
}

func (c *Client) UpdateSettings(path, content string) error {
	return settings.WriteSettings(path, content)
}

func (c *Client) GetSkills(projectPath string) ([]Skill, error) {
	return skills.ReadSkills(projectPath)
}

func (c *Client) GetCommands(projectPath string) ([]Command, error) {
	return commands.ReadCommands(projectPath)
}

func (c *Client) UpdateCommand(path, content string) error {
	return commands.WriteCommand(path, content)
}
