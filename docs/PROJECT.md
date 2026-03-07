# Claudepad — Technical Spec

> A desktop + browser companion app for Claude Code. View and manage your `.claude/` directory contents across global and project scopes.

**Status:** Planning
**Stack decision date:** 2026-03

---

## Problem

Claude Code generates and stores a lot of useful artifacts — implementation plans, todo lists, skills, commands, hooks, session transcripts — but interacting with them means hunting through files with auto-generated whimsical names, editing raw JSON, and losing track of what exists where. There's no good way to get an overview of what Claude Code knows about your projects, what it's configured to do, or what it has produced.

Existing tools like Claudia GUI cover session management and agent control well. Claudepad targets a different layer: the **content and configuration** that Claude Code generates and stores, with a focus on making plans, sessions, skills, commands, hooks, and settings actually manageable.

---

## What We're Building

Claudepad is a local-first desktop app (with a browser mode) that reads and enriches the `~/.claude/` directory and per-project `.claude/` directories. It never replaces or fights Claude Code — it sits alongside it, making the artifacts Claude produces easier to find, name, edit, and track.

### Core sections

| Section | What it covers |
|---|---|
| **Plans** | Markdown plan files from `~/.claude/plans/`, with friendly names, tags, and todo progress |
| **Sessions** | Session transcripts from `~/.claude/projects/`, browsable and searchable |
| **Settings** | Multi-layer `settings.json` hierarchy editable per layer — includes hooks, permissions, and model config |
| **Skills** | `.claude/skills/` markdown files with metadata enrichment |
| **Commands** | `.claude/commands/` slash command files with metadata enrichment |
| **Usage** | Dashboard from `~/.claude/stats-cache.json` — activity, tokens, model breakdown |

---

## Key Design Principles

**Never break Claude Code.** Claudepad does not rename or delete Claude's files. Friendly names, tags, and notes live only in Claudepad's SQLite database. The real filenames on disk are never touched.

**Enrichment layer, not replacement.** The `.claude/` files are always the source of truth. Claudepad reads them, enriches them with metadata, and writes back only when the user explicitly edits content.

**Project-scoped views.** One active project at a time. All seven sections reflect the context of the selected project.

---

## Project Model

Claude Code treats each directory it has been invoked from as a separate project, each with its own `.claude/` folder that overrides or extends the global `~/.claude/` config.

Claudepad models this as:

- **Global** — `~/.claude/`, always present, cannot be removed
- **Registered projects** — user adds via native folder picker (Wails `OpenDirectoryDialog`)
- **Auto-discovery** — on first run, reverse-engineer project paths from `~/.claude/projects/` directory names and offer to import them

Projects are persisted in SQLite. The active project is selected via a dropdown in the topbar — switching reloads all seven sections for that context.

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
    file_type     TEXT NOT NULL,           -- 'plan' | 'skill' | 'command' | 'settings'
    friendly_name TEXT,                    -- user-defined display name
    tags          TEXT NOT NULL DEFAULT '[]',  -- JSON array
    notes         TEXT NOT NULL DEFAULT '',
    archived      INTEGER NOT NULL DEFAULT 0,
    created_at    DATETIME DEFAULT (datetime('now')),
    updated_at    DATETIME DEFAULT (datetime('now'))
);

CREATE TABLE usage_snapshots (
    id             INTEGER PRIMARY KEY AUTOINCREMENT,
    snapshot_date  DATE NOT NULL UNIQUE,
    raw_json       TEXT NOT NULL,
    captured_at    DATETIME DEFAULT (datetime('now'))
);

CREATE TABLE app_settings (
    key        TEXT PRIMARY KEY,
    value      TEXT NOT NULL,
    updated_at DATETIME DEFAULT (datetime('now'))
);
```

### File watching

`fsnotify` watches all registered `.claude/` directories. When Claude Code creates, modifies, or deletes files externally, Claudepad syncs the `file_metadata` table automatically. New files get a UUID and real path but no friendly name — surfaced in the UI as unnamed until the user renames them.

### Todo progress

Plan todos are parsed on-the-fly from markdown checkbox syntax (`- [x]` / `- [ ]`). No SQLite state for todos — the markdown file is the source of truth, progress bars are computed at read time.

---

## Architecture

### Two modes, one backend

Claudepad always runs an HTTP server (Chi router). Wails wraps it with a native window in desktop mode. Browser mode skips the window entirely.

```
Desktop mode:   React → Wails IPC → Go handlers ← HTTP API (also running)
Browser mode:   React → HTTP API → Go handlers
```

The React frontend uses a `lib/api.ts` abstraction layer that calls either Wails IPC bindings or `fetch()` depending on the runtime — TanStack Query sits on top and doesn't care which transport is in use.

```typescript
// lib/api.ts
const isBrowser = !window.__WAILS__

export const getSkills = () =>
  isBrowser
    ? fetch('/api/skills').then(r => r.json())
    : GetSkills() // Wails auto-generated binding
```

### Go package structure

```
claudepad/
├── main.go                         # Wails entry, --browser and --port flags
├── app.go                          # Wails app struct, lifecycle
├── backend/
│   ├── claude/
│   │   ├── fs.go                   # .claude dir discovery, fsnotify watcher
│   │   ├── settings.go             # read/write settings.json hierarchy
│   │   ├── skills.go               # read/write .claude/skills/
│   │   ├── commands.go             # read/write .claude/commands/
│   │   ├── plans.go                # read plans/, parse todos on-the-fly
│   │   ├── sessions.go             # parse projects/ JSONL transcripts
│   │   └── usage.go                # parse stats-cache.json
│   ├── db/
│   │   ├── db.go                   # SQLite init, goose migrations on startup
│   │   ├── migrations/             # versioned .sql files
│   │   ├── queries/                # sqlc .sql query files
│   │   └── generated/              # sqlc output (do not edit)
│   └── api/
│       ├── app.go                  # App struct, Wails bindings (thin wrappers)
│       ├── routes.go               # Chi router, REST endpoints for browser mode
│       ├── handlers/               # One file per domain
│       │   ├── settings.go
│       │   ├── skills.go
│       │   ├── commands.go
│       │   ├── plans.go
│       │   ├── sessions.go
│       │   └── usage.go
│       └── middleware/
│           └── auth.go             # Optional --token bearer auth for browser mode
└── frontend/
    ├── src/
    │   ├── lib/
    │   │   ├── api.ts              # Transport abstraction (Wails IPC vs fetch)
    │   │   └── utils.ts
    │   ├── hooks/                  # TanStack Query hooks per domain
    │   ├── components/
    │   │   ├── ui/                 # shadcn/ui components
    │   │   └── layout/             # Sidebar, Topbar, ProjectSwitcher
    │   ├── pages/
    │   │   ├── Plans.tsx
    │   │   ├── Sessions.tsx
    │   │   ├── Settings.tsx
    │   │   ├── Skills.tsx
    │   │   ├── Commands.tsx
    │   │   └── Usage.tsx
    │   └── main.tsx
    └── index.html
```

### Frontend data flow

```
Wails IPC / fetch()
        ↓
   lib/api.ts          (transport abstraction)
        ↓
TanStack Query          (caching, invalidation, loading/error states)
        ↓
   React pages          (render)
```

---

## Tech Stack

| Layer | Choice | Reason |
|---|---|---|
| Desktop framework | Wails v2 | Go backend, React frontend, system WebView — no Chromium bundle, auto-generates TypeScript bindings from Go methods |
| Backend language | Go | Performance, simple concurrency, strong stdlib for file I/O |
| HTTP router | Chi | Lightweight, idiomatic Go |
| Database | SQLite via `modernc.org/sqlite` | Pure Go, no CGo — avoids cross-compilation headaches with Wails |
| Migrations | Goose | Embeddable as a library, supports Go-based migrations for data transforms, runs automatically on startup |
| Query generation | sqlc | Type-safe Go from raw SQL, validated at codegen time |
| File watching | fsnotify | Standard Go file system events |
| Frontend framework | React + TypeScript | Widest ecosystem, most Wails community examples |
| Routing | TanStack Router | Full TypeScript type safety on route params |
| Data fetching | TanStack Query | Works with any async function (Wails bindings or fetch), devtools included |
| Tables | TanStack Table | Headless, used for Sessions and Settings hierarchy views |
| Component library | shadcn/ui + Tailwind | Owned components, highly customizable, strong ecosystem |
| Code editor | CodeMirror 6 | Lightweight vs Monaco, excellent JSON + Markdown language support |
| Hot reload (dev) | `wails dev` to start, Air when backend iteration speed matters | |

---

## UI Layout

### Global shell

```
┌─────────────────────────────────────────────────┐
│  🗒 Claudepad                    [my-project ▾] │  ← topbar, always visible
├──────────┬──────────────────────────────────────┤
│ 📋 Plans  │                                      │
│ 💬 Sessions│                                     │
│ ⚙ Settings│        main content area            │
│ 🧠 Skills  │                                     │
│ > Commands│                                      │
│ 📊 Usage  │                                      │
└──────────┴──────────────────────────────────────┘
```

- Sidebar: icon + label (VS Code style), always visible
- Topbar: project switcher dropdown — Global + registered projects + "Add project..." option
- Switching project reloads all sections for that context

### Section layouts

**Plans**
List view. Each row: friendly name (fallback to real filename), tags, todo progress bar (X/Y complete, parsed on-the-fly from markdown checkboxes), last modified date. Click row opens master-detail: markdown editor (CodeMirror) on the right, metadata panel below (friendly name, tags, notes).

**Sessions**
Sortable, filterable table. Columns: date, duration, message count, first message snippet, git branch. Click row opens master-detail: read-only transcript viewer on the right, rendered as a clean conversation (not raw JSONL). Session data parsed from `~/.claude/projects/{encoded-path}/*.jsonl`.

**Settings**
Master-detail. Left: tree of config keys grouped by layer (global user, project, local project), with a source badge per key and a conflict indicator on keys that are overridden at a higher layer. Right: CodeMirror JSON editor scoped to the selected key and layer. Save writes only to that layer's file. Hooks are edited directly as JSON within the settings editor — no separate hooks UI.

**Skills**
Card grid. Each card: friendly name (fallback to directory name), tags, first line of SKILL.md as description, last modified. Click card opens a full editor overlay: CodeMirror markdown editor + metadata panel (friendly name, tags, notes).

**Commands**
Card grid (same layout as Skills). Each card: friendly name, tags, description from frontmatter or first line, last modified. Click opens editor overlay: CodeMirror markdown editor + metadata panel.

**Usage**
Full page dashboard. Top row: summary stats cards (total sessions, total messages, total tokens, most used model). Middle: daily activity bar chart. Bottom: model breakdown table (model name, input tokens, output tokens, cache tokens).

---

## Modes

### Desktop (default)

```bash
claudepad
```

Launches the Wails native window. Uses system WebView (WebKit on macOS/Linux, WebView2 on Windows). During development, `wails dev` also serves the frontend at a localhost port for browser devtools access.

### Browser

```bash
claudepad --browser --port 5173
```

Skips the native window, serves the full app over HTTP. Requires a proper REST API layer (not Wails IPC). Optional `--token` flag for bearer auth — useful when exposed beyond localhost.

### Container

Browser mode is the supported container target:

```bash
docker run \
  -v ~/.claude:/root/.claude \
  -v ~/.claudepad:/root/.claudepad \
  -p 5173:5173 \
  claudepad --browser
```

`fsnotify` works across bind mounts on Linux. macOS Docker Desktop may have slower file event propagation due to the VM layer.

---

## What's Out of Scope (v1)

- Live session control or agent interaction (that's Claudia's territory)
- Merged/inherited view across global + project (isolated views only in v1)
- Plan ↔ session linking (kept separate, no inferred relationships)
- Plugin management beyond read-only viewing
- Multi-user or team features
- Cloud sync

---

## Open Questions (post-v1)

- Merged settings/skills view showing global + project inheritance
- Plan ↔ session linking via timestamp correlation
- Export (plans to PDF, sessions to markdown)
- Search across all content (plans, sessions, skills, commands)