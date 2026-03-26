# claudemd

Reads and writes `CLAUDE.md` instruction files used by Claude Code.

## File locations

| Layer   | Path |
|---------|------|
| global  | `~/.claude/CLAUDE.md` |
| project | `<project-root>/CLAUDE.md` |

The project-level file lives at the repository root (not inside `.claude/`).

## API

### `Read(projectPath string) ([]ClaudeMdFile, error)`

Returns CLAUDE.md files for the global layer, plus the project layer when `projectPath` is non-empty. Missing files are returned with `Exists=false` and `Content=""` — no error.

### `Write(path, content string) error`

Writes markdown content to the given path, creating parent directories as needed. No content validation is performed.

## Types

```go
type ClaudeMdFile struct {
    Layer   string // "global" | "project"
    Path    string // absolute path
    Content string // raw markdown, empty if file absent
    Exists  bool
}
```
