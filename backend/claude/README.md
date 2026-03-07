# package claude

Facade over all Claude Code domain packages. `app.go` imports only this package — never sub-packages directly.

## Responsibilities

- Owns the file watcher (`backend/fs.Watcher`) and database connection (`backend/db`)
- Re-exports sub-package types as aliases so Wails bindings stay in one place
- Delegates all reads/writes to domain sub-packages
- Registers all `WatchDir`/`Watch` callbacks that emit frontend events

## Type alias note

Wails resolves type aliases to their underlying package when generating TypeScript bindings. So `type Session = sessions.Session` appears in the frontend under the `sessions` namespace, not `claude`. Import from `wailsjs/go/models` accordingly.

## Sub-packages

| Package    | Source file(s)                              | Frontend event      |
|------------|---------------------------------------------|---------------------|
| `usage`    | `~/.claude/stats-cache.json`                | `usage:stats-updated` |
| `plans`    | `~/.claude/plans/*.md`                      | `plans:updated`     |
| `sessions` | `~/.claude/projects/{encoded}/*.jsonl`      | `sessions:updated`  |
