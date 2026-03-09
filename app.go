package main

import (
	"context"

	"claudepad/backend/claude"

	"github.com/wailsapp/wails/v2/pkg/runtime"
)

// App struct
type App struct {
	ctx    context.Context
	claude *claude.Client
}

// NewApp creates a new App application struct
func NewApp() *App {
	return &App{claude: claude.New()}
}

func (a *App) startup(ctx context.Context) {
	a.ctx = ctx
	_ = a.claude.Start(ctx, func(event string) {
		runtime.EventsEmit(ctx, event)
	})
}

func (a *App) shutdown(_ context.Context) {
	a.claude.Stop()
}

// GetUsageStats returns the parsed contents of ~/.claude/stats-cache.json.
func (a *App) GetUsageStats() (*claude.StatsCache, error) {
	return a.claude.GetUsageStats()
}

// GetPlans returns all plan files from ~/.claude/plans/.
func (a *App) GetPlans() ([]claude.Plan, error) {
	return a.claude.GetPlans()
}

// GetSessions returns all sessions from ~/.claude/projects/.
func (a *App) GetSessions() ([]claude.Session, error) {
	return a.claude.GetSessions()
}

// GetSessionTranscript returns the transcript messages for a session.
func (a *App) GetSessionTranscript(projectPath, sessionID string) ([]claude.TranscriptMessage, error) {
	return a.claude.GetSessionTranscript(projectPath, sessionID)
}

// GetProjects returns all registered projects, global first.
func (a *App) GetProjects() ([]claude.Project, error) {
	return a.claude.GetProjects()
}

// AddProject registers a directory as a project.
func (a *App) AddProject(path string) error {
	_, err := a.claude.AddProject(path)
	if err != nil {
		return err
	}
	runtime.EventsEmit(a.ctx, "projects:updated")
	return nil
}

// RemoveProject removes a project by ID.
func (a *App) RemoveProject(id string) error {
	if err := a.claude.RemoveProject(id); err != nil {
		return err
	}
	runtime.EventsEmit(a.ctx, "projects:updated")
	return nil
}

// PickProjectDir opens a native folder picker and returns the selected path.
func (a *App) PickProjectDir() string {
	path, _ := runtime.OpenDirectoryDialog(a.ctx, runtime.OpenDialogOptions{
		Title: "Select project directory",
	})
	return path
}

// SetProjectLastOpened updates the last_opened timestamp for a project.
func (a *App) SetProjectLastOpened(id string) error {
	return a.claude.SetProjectLastOpened(id)
}

// GetSettings returns settings files for the global and optionally project layer.
func (a *App) GetSettings(projectPath string) ([]claude.SettingsFile, error) {
	return a.claude.GetSettings(projectPath)
}

// UpdateSettings validates and writes JSON content to the given settings file path.
func (a *App) UpdateSettings(path, content string) error {
	return a.claude.UpdateSettings(path, content)
}

// GetSkills returns skills from ~/.claude/skills/ (global) merged with <projectPath>/.claude/skills/ (project).
// Pass empty string for projectPath to get global skills only.
func (a *App) GetSkills(projectPath string) ([]claude.Skill, error) {
	return a.claude.GetSkills(projectPath)
}

// GetCommands returns commands from ~/.claude/commands/ (global) merged with <projectPath>/.claude/commands/ (project).
// Pass empty string for projectPath to get global commands only.
func (a *App) GetCommands(projectPath string) ([]claude.Command, error) {
	return a.claude.GetCommands(projectPath)
}

// UpdateCommand writes updated content to the given command file path.
func (a *App) UpdateCommand(path, content string) error {
	return a.claude.UpdateCommand(path, content)
}

// SetPlanName stores a friendly display name for a plan. Pass empty string to clear.
func (a *App) SetPlanName(path, name string) error {
	return a.claude.SetPlanName(path, name)
}

// SetPlanMeta stores metadata for a plan (pin, priority, due date, project, tags, notes, archived).
// Call SetPlanName separately to change the friendly display name.
func (a *App) SetPlanMeta(path string, meta claude.PlanMeta) error {
	return a.claude.SetPlanMeta(path, meta)
}
