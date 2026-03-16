# Claudepad — Technical Spec

> A desktop companion app for Claude Code. View and manage your `.claude/` directory contents across global and project scopes.

**Status:** In Development
**Stack decision date:** 2026-03

---

## Problem

Claude Code generates and stores a lot of useful artifacts — implementation plans, todo lists, skills, commands, hooks, session transcripts — but interacting with them means hunting through files with auto-generated whimsical names, editing raw JSON, and losing track of what exists where. There's no good way to get an overview of what Claude Code knows about your projects, what it's configured to do, or what it has produced.

Existing tools like Claudia GUI cover session management and agent control well. Claudepad targets a different layer: the **content and configuration** that Claude Code generates and stores, with a focus on making plans, sessions, skills, commands, hooks, and settings actually manageable.

---

## What We're Building

Claudepad is a local-first desktop app that reads and enriches the `~/.claude/` directory and per-project `.claude/` directories. It never replaces or fights Claude Code — it sits alongside it, making the artifacts Claude produces easier to find, name, edit, and track.

### Core sections

| Section | What it covers |
|---|---|
| **Plans** | Markdown plan files from `~/.claude/plans/`, with friendly names, tags, and todo progress |
| **Sessions** | Session transcripts from `~/.claude/projects/`, browsable and searchable |
| **Settings** | Multi-layer `settings.json` hierarchy editable per layer — hooks are edited directly as JSON within the settings editor |
| **Skills** | `.claude/skills/` markdown files — read and edit UI |
| **Commands** | `.claude/commands/` slash command files — read and edit UI |
| **Usage** | Dashboard from `~/.claude/stats-cache.json` — activity, tokens, model breakdown |
| **Notes** | Markdown notes in `~/.claudepad/notes/`, captured from Claude Code sessions via slash command or MCP tool |
| **MCP Servers** | View and manage MCP server entries in `~/.claude.json`, including the built-in Claudepad server |

---

## Key Design Principles

**Never break Claude Code.** Claudepad does not rename or delete Claude's files. Friendly names, tags, and notes live only in Claudepad's SQLite database. The real filenames on disk are never touched (except for notes, which Claudepad owns entirely).

**Enrichment layer, not replacement.** The `.claude/` files are always the source of truth. Claudepad reads them, enriches them with metadata where applicable, and writes back only when the user explicitly edits content.

**Project-scoped views.** One active project at a time. All sections reflect the context of the selected project.

---

## Project Model

Claude Code treats each directory it has been invoked from as a separate project, each with its own `.claude/` folder that overrides or extends the global `~/.claude/` config.

Claudepad models this as:

- **Global** — `~/.claude/`, always present, cannot be removed
- **Registered projects** — user adds via native folder picker (Wails `OpenDirectoryDialog`)
- **Auto-discovery** — on first run, reverse-engineer project paths from `~/.claude/projects/` directory names and offer to import them

Projects are persisted in SQLite. The active project is selected via a dropdown in the sidebar — switching reloads all sections for that context.

v1 shows isolated views per project (no merged/inherited view). A future version can add a merged view showing which items are inherited from global vs defined locally.

---

## Data Model

### The enrichment layer

Claudepad maintains a SQLite database at `~/.claudepad/claudepad.db`. It never duplicates file content — it only stores metadata that doesn't exist in the `.claude/` files themselves.

```sql
CREATE TABLE projects (
    id           TEXT PRIMARY KEY,
    name         TEXT,
    real_path    TEXT NOT NULL UNIQUE,
    is_global    INTEGER DEFAULT 0,
    last_opened  DATETIME,
    created_at   DATETIME DEFAULT (datetime('now'))
);

CREATE TABLE file_metadata (
    id            TEXT PRIMARY KEY,        -- UUID, stable internal ID
    real_path     TEXT NOT NULL UNIQUE,    -- absolute path on disk
    file_type     TEXT NOT NULL,           -- 'plan' | 'note' | 'skill' | 'command'
    friendly_name TEXT,                    -- user-defined display name
    tags          TEXT NOT NULL DEFAULT '[]',  -- JSON array
    notes         TEXT NOT NULL DEFAULT '',
    archived      INTEGER NOT NULL DEFAULT 0,
    pinned        INTEGER NOT NULL DEFAULT 0,
    project_id    TEXT,                    -- plans: associated project UUID
    created_at    DATETIME DEFAULT (datetime('now')),
    updated_at    DATETIME DEFAULT (datetime('now'))
);
```

Note: `usage_snapshots` and `app_settings` tables exist in the schema but are not being implemented in the current phase.

### File watching

`fsnotify` watches all registered `.claude/` directories and `~/.claudepad/notes/`. When Claude Code creates, modifies, or deletes files externally, Claudepad detects changes via file system events and invalidates the relevant TanStack Query cache (via Wails events emitted to the frontend). New plan files get a UUID and real path but no friendly name — surfaced in the UI as unnamed until the user renames them. Notes written by the MCP server or slash command appear in the Notes page automatically without any manual refresh.

### Todo progress

Plan todos are parsed on-the-fly from markdown checkbox syntax (`- [x]` / `- [ ]`). No SQLite state for todos — the markdown file is the source of truth, progress bars are computed at read time.

### Notes

Notes live in `~/.claudepad/notes/{YYYY-MM-DD}-{slug}.md`. Unlike plan files (which belong to Claude Code), notes are owned by Claudepad — they are never auto-deleted by Claude Code. Each note file uses YAML frontmatter:

```markdown
---
title: How streams work in Go
project: /Users/ngomez/code/myproject
---

[note body in markdown]
```

Mutable metadata (tags, pinned, archived, private annotations) is stored in SQLite with `file_type='note'`. The title in frontmatter is used as the display name; if absent, a title is derived from the filename.

### MCP server configuration

`~/.claude.json` holds the `mcpServers` map that Claude Code reads to discover MCP servers. Claudepad reads and writes only the `mcpServers` key in that file, preserving all other content. On startup, Claudepad automatically upserts its own entry:

```json
{
  "mcpServers": {
    "claudepad": { "type": "sse", "url": "http://127.0.0.1:45789/sse" }
  }
}
```

See `docs/MCP.md` for full details on the embedded MCP server.

---

## Architecture

### Desktop mode

Claudepad runs in desktop mode via Wails. The React frontend communicates with the Go backend through Wails IPC auto-generated bindings.

```
Desktop mode:  React → Wails IPC → Go handlers
```

The React frontend uses a `lib/api.ts` abstraction layer that re-exports Wails IPC bindings. TanStack Query sits on top and handles caching, invalidation, and loading states.

### Go package structure

```
claudepad/
├── main.go                         # Wails entry
├── app.go                          # Wails app struct, lifecycle, bindings
├── backend/
│   ├── claude/
│   │   ├── claude.go               # Client struct, facade over sub-packages
│   │   ├── commands/               # read/write .claude/commands/
│   │   ├── notes/                  # read/write ~/.claudepad/notes/ (owned by Claudepad)
│   │   ├── plans/                  # read plans/, parse todos on-the-fly
│   │   ├── projects/               # project registry operations
│   │   ├── sessions/               # parse projects/ JSONL transcripts
│   │   ├── settings/               # read/write settings.json + ~/.claude.json mcpServers
│   │   ├── skills/                 # read/write .claude/skills/
│   │   └── usage/                  # parse stats-cache.json
│   ├── db/
│   │   ├── db.go                   # SQLite init, goose migrations on startup
│   │   ├── migrations/             # versioned .sql files
│   │   ├── queries/                # sqlc .sql query files
│   │   └── generated/              # sqlc output (do not edit)
│   ├── fs/                         # fsnotify watcher (shared)
│   └── mcp/
│       └── server.go               # Embedded SSE-based MCP server (port 45789)
└── frontend/
    ├── src/
    │   ├── lib/
    │   │   ├── api.ts              # Transport abstraction (Wails IPC re-exports)
    │   │   ├── types.ts            # Hand-maintained types not generated by Wails
    │   │   └── utils.ts
    │   ├── hooks/                  # TanStack Query hooks per domain
    │   │   ├── useCommands.ts
    │   │   ├── useNotes.ts
    │   │   ├── usePlans.ts
    │   │   ├── useProjects.ts
    │   │   ├── useSessions.ts
    │   │   ├── useSettings.ts
    │   │   ├── useSkills.ts
    │   │   ├── useTranscript.ts
    │   │   └── useUsageStats.ts
    │   ├── components/
    │   │   ├── ui/                 # shadcn/ui components
    │   │   └── MarkdownView.tsx
    │   ├── pages/
    │   │   ├── Commands.tsx
    │   │   ├── McpServers.tsx
    │   │   ├── Notes.tsx
    │   │   ├── Plans.tsx
    │   │   ├── Sessions.tsx
    │   │   ├── Settings.tsx
    │   │   ├── Skills.tsx
    │   │   └── Usage.tsx
    │   └── main.tsx
    └── index.html
```

### Frontend data flow

```
Wails IPC
    ↓
lib/api.ts          (transport abstraction)
    ↓
TanStack Query      (caching, invalidation, loading/error states) — in progress
    ↓
React pages         (render)
```

---

## Tech Stack

| Layer | Choice | Reason |
|---|---|---|
| Desktop framework | Wails v2 | Go backend, React frontend, system WebView — no Chromium bundle, auto-generates TypeScript bindings from Go methods |
| Backend language | Go | Performance, simple concurrency, strong stdlib for file I/O |
| Database | SQLite via `modernc.org/sqlite` | Pure Go, no CGo — avoids cross-compilation headaches with Wails |
| Migrations | Goose | Embeddable as a library, supports Go-based migrations for data transforms, runs automatically on startup |
| Query generation | sqlc | Type-safe Go from raw SQL, validated at codegen time |
| File watching | fsnotify | Standard Go file system events |
| Frontend framework | React + TypeScript | Widest ecosystem, most Wails community examples |
| Data fetching | TanStack Query | Works with any async function (Wails bindings), caching and invalidation — in progress |
| Component library | shadcn/ui + Tailwind | Owned components, highly customizable, strong ecosystem |
| Code editor | CodeMirror 6 | Lightweight vs Monaco, excellent JSON + Markdown language support |
| Hot reload (dev) | `wails dev` | |

---

## UI Layout

### Global shell

```
┌─────────────────────────────────────────────────┐
│  Claudepad                                       │  ← title
├──────────────────────────────────────────────────┤
│ [my-project ▾]  [+]                              │  ← project picker in sidebar
├──────────┬───────────────────────────────────────┤
│  Plans   │                                       │
│  Sessions│                                       │
│  Settings│        main content area              │
│  Skills  │                                       │
│  Commands│                                       │
│  Usage   │                                       │
│  Notes   │                                       │
│  MCP     │                                       │
└──────────┴───────────────────────────────────────┘
```

- Sidebar: icon + label (VS Code style), always visible, includes project picker
- Switching project reloads all sections for that context

### Section layouts

**Plans**
Master-detail. Left: list of plans with friendly name, tags, todo progress bar, last modified. Right: markdown viewer (rendered or raw) with rename, archive, metadata panel (tags, notes, pinned, project association).

**Sessions**
Master-detail. Left: filterable list of sessions. Right: read-only transcript viewer rendered as a clean conversation. Session data parsed from `~/.claude/projects/{encoded-path}/*.jsonl`.

**Settings**
Three-tab editor (Global / Project / Local). Each tab opens the corresponding `settings.json` in a CodeMirror JSON editor. Hooks are edited directly as JSON within the settings editor — no separate hooks UI.

**Skills**
Master-detail. Left: list of skills with name, description, scope badge, last modified. Right: markdown viewer (rendered or raw). Skills are read-only in the viewer (no metadata enrichment panel).

**Commands**
Master-detail. Left: list of commands with name, description, scope badge, last modified. Right: CodeMirror markdown editor with save button. Commands are directly editable (no metadata enrichment panel).

**Usage**
Full page dashboard. Top row: summary stats cards (total sessions, total messages, total tokens, most used model). Middle: daily activity bar chart. Bottom: model breakdown table.

**Notes**
Master-detail layout. Left: searchable list of notes with title, word count, date, tags; pinned notes float to top; archived toggle hides archived notes. Right: rendered markdown view with inline rename, pin/archive/delete controls, and a metadata popup (tags, private annotations). Notes are owned by Claudepad and stored in `~/.claudepad/notes/` — they are never auto-deleted. Two capture paths: `/cpad-save-note` slash command in Claude Code, or the built-in `save_note` MCP tool.

**MCP Servers**
Displays a status banner for the built-in Claudepad MCP server (always running, pre-configured). Below it, a list of user-added MCP servers from `~/.claude.json` with add/edit/delete controls. The config for each server is editable as raw JSON.

---

## What's Out of Scope

- Browser mode / REST API layer — desktop-only for now; browser mode may be added in a future phase
- Live session control or agent interaction (that's Claudia's territory)
- Merged/inherited view across global + project (isolated views only)
- Plan ↔ session linking (kept separate, no inferred relationships)
- Plugin management beyond read-only viewing
- Multi-user or team features
- Cloud sync
- `usage_snapshots` and `app_settings` SQLite tables — schema exists but not implemented yet

---

## Open Questions (post-v1)

- Merged settings/skills view showing global + project inheritance
- Plan ↔ session linking via timestamp correlation
- Export (plans to PDF, sessions to markdown)
- Search across all content (plans, sessions, skills, commands)
- Browser mode / container deployment
