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
