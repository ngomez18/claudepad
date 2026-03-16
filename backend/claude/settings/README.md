# backend/claude/settings

Reads and writes Claude Code `settings.json` files at two layers: global and project.

## File paths

Claude Code uses a 4-level hierarchy (highest to lowest priority):

| Layer | Path | Shared? |
|-------|------|---------|
| Managed | `managed-settings.json` (MDM/org-controlled) | — |
| Local | `{projectPath}/.claude/settings.local.json` | No (gitignored) |
| Project | `{projectPath}/.claude/settings.json` | Yes (committed) |
| Global | `~/.claude/settings.json` | Personal |

`ReadSettings` returns the Global, Project, and Local layers (Managed is out of scope).

## API

### `ReadSettings(projectPath string) ([]SettingsFile, error)`

Returns settings for the global layer and, if `projectPath` is non-empty, the project layer. If a file doesn't exist, returns a `SettingsFile` with `Exists: false` and `Content: "{}"` so the frontend can pre-populate the editor with a valid empty object.

### `WriteSettings(path, content string) error`

Validates that `content` is valid JSON, creates parent directories if needed, then writes the file. Returns an error if the JSON is invalid.

## Behavior when file is missing

`ReadSettings` never errors on a missing file. Callers receive a `SettingsFile` with:
- `Exists: false`
- `Content: "{}"`

The frontend uses `Exists` to show a notice: "This file doesn't exist yet — saving will create it."

## MCP server configuration

The `mcpServers` key in `~/.claude.json` configures MCP servers for Claude Code.

### `ReadMcpServers() (map[string]McpServerConfig, error)`

Reads the `mcpServers` object from `~/.claude.json`. Returns an empty map if the file or key is absent. Never errors on missing file.

### `WriteMcpServers(servers map[string]McpServerConfig) error`

Updates only the `mcpServers` key in `~/.claude.json`, preserving all other keys. Creates the file if it doesn't exist.

### `McpServerConfig` fields

| Field | Description |
|---|---|
| `type` | `"stdio"` \| `"sse"` \| `"http"` |
| `command` | Executable path (stdio only) |
| `args` | Command arguments |
| `url` | Server URL (sse/http only) |
| `headers` | HTTP headers map |
