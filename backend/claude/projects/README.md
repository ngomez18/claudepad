# package projects

Manages the project registry stored in SQLite. Projects map human-readable names and IDs to the encoded directory names Claude Code uses under `~/.claude/projects/`.

## Concepts

**Encoded path:** Claude Code stores per-project session files under a directory whose name is the project's absolute path with every `/` replaced by `-`, e.g. `/Users/alice/code/myapp` → `-Users-alice-code-myapp`. This package derives `EncodedName` from `RealPath` on read; it is never stored.

**Global project:** A synthetic project row (`is_global = 1`) whose `real_path` is `~/.claude`. It represents the user's global Claude Code context and is created automatically on first use. It cannot be removed.

## SQLite schema

```sql
CREATE TABLE IF NOT EXISTS projects (
    id          TEXT PRIMARY KEY,
    name        TEXT,
    real_path   TEXT NOT NULL UNIQUE,
    is_global   INTEGER DEFAULT 0,
    last_opened DATETIME,
    created_at  DATETIME DEFAULT (datetime('now'))
);
```

## API

| Function | Description |
|---|---|
| `ReadProjects(db, claudeDir)` | Returns all projects. Ensures the global row exists (idempotent upsert). Global is always first; rest sorted by `last_opened DESC`. |
| `DiscoverProjects(db, claudeDir)` | Scans `~/.claude/projects/` and returns entries not yet in the DB. Caller decides whether to register them. |
| `AddProject(db, path)` | Validates path exists, inserts a new row (or no-ops if already present), returns the project. |
| `RemoveProject(db, id)` | Deletes a project. Returns an error if `is_global = 1`. |
| `UpdateLastOpened(db, id)` | Sets `last_opened = datetime('now')`. Called when the user switches to a project. |

## Path resolution in `DiscoverProjects`

For each encoded directory name found on disk, the real path is resolved in order:

1. Read the first `.jsonl` file and extract the `cwd` field (most accurate — set by Claude Code at session start).
2. Fall back to replacing all `-` with `/` in the encoded name and prepending `/` if missing.

## Auto-discovery on startup

`claude.Client.Start()` calls `DiscoverProjects` in a background goroutine and registers any new entries via `AddProject`. This is best-effort: errors are silently ignored. A `projects:updated` event is emitted if any new projects were registered.
