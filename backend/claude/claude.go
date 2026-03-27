package claude

import (
	"context"
	"os"
	"path/filepath"

	"claudepad/backend/claude/claudemd"
	"claudepad/backend/claude/commands"
	"claudepad/backend/claude/notes"
	"claudepad/backend/claude/plans"
	"claudepad/backend/claude/projects"
	"claudepad/backend/claude/sessions"
	"claudepad/backend/claude/settings"
	"claudepad/backend/claude/skills"
	"claudepad/backend/claude/usage"
	"claudepad/backend/db"
	fswatch "claudepad/backend/fs"
	"claudepad/backend/mcp"
)

// Re-export sub-package types so app.go only needs this package.
type ClaudeMdFile = claudemd.ClaudeMdFile
type StatsCache = usage.StatsCache
type McpServerConfig = settings.McpServerConfig
type Plan = plans.Plan
type Session = sessions.Session
type TranscriptMessage = sessions.TranscriptMessage
type Project = projects.Project
type SettingsFile = settings.SettingsFile
type Skill = skills.Skill
type Command = commands.Command
type PlanMeta = plans.PlanMeta
type Note = notes.Note
type NoteMeta = notes.NoteMeta

// Client provides access to Claude Code's local data files.
// It owns the file watcher and all path resolution — callers never touch paths directly.
type Client struct {
	watcher   *fswatch.Watcher
	db        *db.DB
	claudeDir string
	emit      func(string) // stored for dynamic re-registration (e.g. per-project watches)
}

func New() *Client {
	return &Client{}
}

// Start initialises the database and file watcher. emit is called with an event
// name whenever a watched file changes; pass runtime.EventsEmit or equivalent.
func (c *Client) Start(ctx context.Context, emit func(event string)) error {
	home, err := os.UserHomeDir()
	if err != nil {
		return err
	}
	c.claudeDir = filepath.Join(home, ".claude")

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
	c.emit = emit
	if err := c.registerWatches(emit); err != nil {
		return err
	}

	// Sync live plans to preservation folder on startup (best-effort).
	go func() {
		if live, err := plans.ReadPlans(c.db.Queries()); err == nil {
			_ = plans.SyncToPreserved(live)
		}
	}()

	// Install save-note slash command and notes skill on startup (best-effort).
	go func() {
		_ = notes.InstallSaveNoteCommand()
		_ = notes.InstallNotesSkill()
	}()

	// Start embedded MCP server and register it in ~/.claude.json (best-effort).
	go func() {
		_, port, err := mcp.Start(ctx, mcp.DefaultPort)
		if err != nil {
			return
		}
		_ = settings.InstallMcpServer(port)
	}()

	// Auto-discover projects from disk on startup (best-effort).
	go func() {
		select {
		case <-ctx.Done():
			return
		default:
		}
		q := c.db.Queries()
		discovered, err := projects.DiscoverProjects(q, c.claudeDir)
		if err != nil {
			return
		}
		for _, p := range discovered {
			_, _ = projects.AddProject(q, p.RealPath)
		}
		if len(discovered) > 0 {
			emit("projects:updated")
		}

		// Register per-project watches for all known non-global projects.
		knownProjects, _ := projects.ReadProjects(q, c.claudeDir)
		for _, p := range knownProjects {
			if !p.IsGlobal {
				c.registerProjectWatches(p.RealPath)
			}
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

// registerProjectWatches sets up per-project watches for <projectPath>/.claude/.
// All errors are silently ignored — per-project watches are best-effort.
func (c *Client) registerProjectWatches(projectPath string) {
	d := filepath.Join(projectPath, ".claude")
	_ = c.watcher.Watch(filepath.Join(d, "settings.json"), func() { c.emit("settings:updated") })
	_ = c.watcher.Watch(filepath.Join(d, "settings.local.json"), func() { c.emit("settings:updated") })
	_ = c.watcher.WatchDir(filepath.Join(d, "skills"), func() { c.emit("skills:updated") })
	_ = c.watcher.WatchDir(filepath.Join(d, "commands"), func() { c.emit("commands:updated") })
	_ = c.watcher.Watch(filepath.Join(projectPath, "CLAUDE.md"), func() { c.emit("claudemd:updated") })
}

// registerWatches sets up all file watches for the global ~/.claude/ directory.
func (c *Client) registerWatches(emit func(string)) error {
	if err := c.watcher.Watch(
		filepath.Join(c.claudeDir, "stats-cache.json"),
		func() { emit("usage:stats-updated") },
	); err != nil {
		return err
	}

	if err := c.watcher.Watch(
		filepath.Join(c.claudeDir, "settings.json"),
		func() { emit("settings:updated") },
	); err != nil {
		return err
	}

	if err := c.watcher.Watch(
		filepath.Join(c.claudeDir, "CLAUDE.md"),
		func() { emit("claudemd:updated") },
	); err != nil {
		return err
	}

	if err := c.watcher.WatchDir(
		filepath.Join(c.claudeDir, "plans"),
		func() {
			if live, err := plans.ReadPlans(c.db.Queries()); err == nil {
				_ = plans.SyncToPreserved(live)
			}
			emit("plans:updated")
		},
	); err != nil {
		return err
	}

	preservedPlansDir, preservedErr := plans.PreservedDir()
	if preservedErr == nil {
		if err := c.watcher.WatchDir(preservedPlansDir, func() { emit("plans:updated") }); err != nil {
			return err
		}
	}

	if err := c.watcher.WatchDir(
		filepath.Join(c.claudeDir, "projects"),
		func() { emit("sessions:updated") },
	); err != nil {
		return err
	}

	if err := c.watcher.WatchDir(
		filepath.Join(c.claudeDir, "skills"),
		func() { emit("skills:updated") },
	); err != nil {
		return err
	}

	if err := c.watcher.WatchDir(
		filepath.Join(c.claudeDir, "commands"),
		func() { emit("commands:updated") },
	); err != nil {
		return err
	}

	notesDirPath, notesDirErr := notes.NotesDir()
	if notesDirErr == nil {
		if err := c.watcher.WatchDir(notesDirPath, func() { emit("notes:updated") }); err != nil {
			return err
		}
	}

	return nil
}

func (c *Client) GetUsageStats() (*StatsCache, error) {
	return usage.ReadStatsCache()
}

func (c *Client) GetPlans() ([]Plan, error) {
	return plans.ReadPlans(c.db.Queries())
}

func (c *Client) GetPreservedPlans() ([]Plan, error) {
	live, _ := plans.ReadPlans(c.db.Queries())
	return plans.ReadPreservedPlans(c.db.Queries(), live)
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

func (c *Client) GetProjects() ([]Project, error) {
	return projects.ReadProjects(c.db.Queries(), c.claudeDir)
}

func (c *Client) DiscoverProjects() ([]Project, error) {
	return projects.DiscoverProjects(c.db.Queries(), c.claudeDir)
}

func (c *Client) AddProject(path string) (Project, error) {
	p, err := projects.AddProject(c.db.Queries(), path)
	if err != nil {
		return p, err
	}
	c.registerProjectWatches(p.RealPath)
	return p, nil
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

func (c *Client) UpdateSkill(path, content string) error {
	return skills.WriteSkill(path, content)
}

func (c *Client) GetMcpServers() (map[string]McpServerConfig, error) {
	return settings.ReadMcpServers()
}

func (c *Client) SetMcpServers(servers map[string]McpServerConfig) error {
	return settings.WriteMcpServers(servers)
}

func (c *Client) DeleteNote(path string) error {
	return notes.DeleteNote(path)
}

func (c *Client) GetNotes() ([]Note, error) {
	return notes.ReadNotes(c.db.Queries())
}

func (c *Client) SetNoteTitle(path, title string) error {
	return notes.SetNoteTitle(c.db.Queries(), path, title)
}

func (c *Client) SetNoteMeta(path string, meta NoteMeta) error {
	return notes.SetNoteMeta(c.db.Queries(), path, meta)
}

func (c *Client) GetClaudeMd(projectPath string) ([]ClaudeMdFile, error) {
	return claudemd.Read(projectPath)
}

func (c *Client) UpdateClaudeMd(path, content string) error {
	return claudemd.Write(path, content)
}
