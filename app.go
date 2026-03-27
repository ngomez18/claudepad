package main

import (
	"context"

	"claudepad/backend/claude"
	"claudepad/backend/shell"

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

// GetPreservedPlans returns plans that exist in ~/.claudepad/plans/ but no longer in ~/.claude/plans/.
func (a *App) GetPreservedPlans() ([]claude.Plan, error) {
	return a.claude.GetPreservedPlans()
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

// RevealInFinder reveals a file or directory in Finder.
func (a *App) RevealInFinder(path string) error {
	return shell.OpenDir(path)
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

// UpdateSkill writes updated content to the given SKILL.md path.
func (a *App) UpdateSkill(path, content string) error {
	return a.claude.UpdateSkill(path, content)
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

// GetMcpServers returns the mcpServers config from ~/.claude.json.
func (a *App) GetMcpServers() (map[string]claude.McpServerConfig, error) {
	return a.claude.GetMcpServers()
}

// SetMcpServers updates the mcpServers key in ~/.claude.json.
func (a *App) SetMcpServers(servers map[string]claude.McpServerConfig) error {
	return a.claude.SetMcpServers(servers)
}

// DeleteNote removes a note file from disk.
func (a *App) DeleteNote(path string) error {
	return a.claude.DeleteNote(path)
}

// GetNotes returns all note files from ~/.claudepad/notes/.
func (a *App) GetNotes() ([]claude.Note, error) {
	return a.claude.GetNotes()
}

// SetNoteTitle stores a friendly display title for a note. Pass empty string to clear.
func (a *App) SetNoteTitle(path, title string) error {
	return a.claude.SetNoteTitle(path, title)
}

// SetNoteMeta stores metadata for a note (tags, pinned, notes, archived, folderId).
func (a *App) SetNoteMeta(path string, meta claude.NoteMeta) error {
	return a.claude.SetNoteMeta(path, meta)
}

// GetNoteFolders returns all note folders, pinned first then alphabetical.
func (a *App) GetNoteFolders() ([]claude.Folder, error) {
	return a.claude.GetNoteFolders()
}

// CreateNoteFolder creates a new note folder with the given name.
func (a *App) CreateNoteFolder(name string) (claude.Folder, error) {
	return a.claude.CreateNoteFolder(name)
}

// RenameFolder updates the display name of a folder.
func (a *App) RenameFolder(id, name string) error {
	return a.claude.RenameFolder(id, name)
}

// SetFolderPinned updates the pinned state of a folder.
func (a *App) SetFolderPinned(id string, pinned bool) error {
	return a.claude.SetFolderPinned(id, pinned)
}

// DeleteFolder removes a folder and moves its notes to Uncategorized.
func (a *App) DeleteFolder(id string) error {
	return a.claude.DeleteFolder(id)
}

// GetClaudeMd returns CLAUDE.md files for the global and optionally project layer.
func (a *App) GetClaudeMd(projectPath string) ([]claude.ClaudeMdFile, error) {
	return a.claude.GetClaudeMd(projectPath)
}

// UpdateClaudeMd writes markdown content to the given CLAUDE.md path.
func (a *App) UpdateClaudeMd(path, content string) error {
	return a.claude.UpdateClaudeMd(path, content)
}

// ResumeSession opens the user's preferred terminal and runs `claude --resume <sessionID>`
// in the session's working directory.
func (a *App) ResumeSession(cwd, sessionID string) error {
	return shell.OpenWithCommand(cwd, "claude --resume "+sessionID)
}
