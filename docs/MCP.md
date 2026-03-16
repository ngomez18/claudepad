# MCP Server

Claudepad ships with an embedded MCP (Model Context Protocol) server that runs automatically inside the Claudepad process. It is pre-configured in `~/.claude.json` on startup, so Claude Code can use its tools without any manual setup.

---

## What is MCP?

MCP (Model Context Protocol) is how Claude Code discovers and calls external tools. Each MCP server exposes a set of tools; Claude Code invokes them during a session. Claudepad's MCP server exposes the `save_note` tool, which lets Claude write a note directly to Claudepad's notes folder.

---

## Transport: SSE (Server-Sent Events)

Claude Code supports two MCP transports:

- **stdio** — Claude Code spawns a subprocess and communicates over stdin/stdout.
- **SSE** — Claude Code connects to an HTTP server. The client opens a long-lived `GET /sse` stream to receive messages; it sends requests by `POST`ing to `/messages`.

Claudepad uses SSE because the server runs as a goroutine inside the Claudepad process rather than as a separate binary. This means:

- No installation of a separate binary.
- No PATH configuration.
- The MCP server is always available as long as Claudepad is running.

---

## Implementation

**Package:** `backend/mcp/server.go`

The server is started by `backend/claude/claude.go` during app initialization:

```go
_, port, err := mcp.Start(ctx, mcp.DefaultPort)
if err != nil {
    return
}
_ = settings.InstallMcpServer(port)
```

`mcp.Start` tries port `45789` first. If that port is already in use, it falls back to any available port. The actual port is then written to `~/.claude.json`.

### HTTP endpoints

| Method | Path | Purpose |
|--------|------|---------|
| `GET` | `/sse` | Opens an SSE stream. Server sends an `endpoint` event with the POST URL. |
| `POST` | `/messages?sessionId=<id>` | Receives JSON-RPC 2.0 requests from Claude Code. |

### Protocol

The server implements MCP protocol version `2024-11-05` using JSON-RPC 2.0.

| Method | Behaviour |
|--------|-----------|
| `initialize` | Returns server capabilities and info |
| `notifications/initialized` | Acknowledged (no response) |
| `tools/list` | Returns the `save_note` tool schema |
| `tools/call` | Dispatches to `save_note` handler |

---

## Auto-configuration

On startup, Claudepad upserts the `claudepad` entry in `~/.claude.json`:

```json
{
  "mcpServers": {
    "claudepad": {
      "type": "sse",
      "url": "http://127.0.0.1:45789/sse"
    }
  }
}
```

Only the `mcpServers` key is touched — all other content in `~/.claude.json` is preserved via `json.RawMessage` round-tripping.

---

## The `save_note` Tool

**Description:** Save a note to Claudepad (`~/.claudepad/notes/`)

**Input schema:**

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `title` | string | yes | Concise title (5–8 words) |
| `content` | string | yes | Markdown body |
| `cwd` | string | no | Current working directory (stored as `project` in frontmatter) |

**What it does:**

1. Creates `~/.claudepad/notes/` if it doesn't exist.
2. Derives a filename: `{YYYY-MM-DD}-{slug}.md` where the slug is the title lowercased with non-alphanumeric characters replaced by hyphens, truncated to 40 characters.
3. Writes the note with YAML frontmatter:
   ```markdown
   ---
   title: How streams work in Go
   project: /Users/ngomez/code/myproject
   ---

   [content]
   ```
4. Returns the full path of the saved file.

Claudepad's fsnotify watcher detects the new file and emits a `notes:updated` event to the frontend, which causes the Notes page to refresh automatically.

---

## Slash Command Capture

In addition to direct MCP tool calls, Claudepad installs a slash command at startup:

**File:** `~/.claude/commands/cpad-save-note.md`

```markdown
---
description: Save the most recent answer as a note in Claudepad
allowed-tools: Bash Write
---

Extract the most recent substantive answer from this conversation and save it as a note in Claudepad.
...
```

Typing `/cpad-save-note` in any Claude Code session invokes this command. Claude extracts the most recent answer, generates a title, and writes the note file directly. The `allowed-tools: Bash Write` frontmatter means Claude does not prompt for tool permissions.

---

## MCP Servers Page

`frontend/src/pages/McpServers.tsx` shows:

- A status banner for the built-in Claudepad server (always running), displaying the live SSE URL.
- A list of any additional MCP servers the user has configured in `~/.claude.json`.
- Add / edit / delete controls for user-added servers. Edits are written back to `~/.claude.json` via `SetMcpServers`.

The Claudepad entry is displayed read-only and is not included in the editable list.

---

## Shutdown

The MCP HTTP server shuts down gracefully when the Claudepad process exits. The `Start` function accepts a `context.Context`; when the context is cancelled (Wails app shutdown), the server calls `http.Server.Shutdown` with a 2-second timeout.
