# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Commands

```bash
# Development (hot reload for both frontend and backend)
wails dev

# Production build
wails build

# Frontend only (from frontend/)
npm run dev       # Vite dev server
npm run build     # Production build
```

During `wails dev`, the app is also accessible in a browser at `http://localhost:34115` — useful for browser devtools access to Go methods.

## Architecture

Claudepad is a local-first desktop app (and optionally browser-served) for managing Claude Code's `.claude/` directory. It is currently at the boilerplate stage; the full planned architecture is in `docs/PROJECT.md`.

**Stack:** Wails v2 (Go 1.23 backend + React 18 + Vite frontend), SQLite (`modernc.org/sqlite` — pure Go, no CGo), Chi router, Goose migrations, sqlc for type-safe queries, fsnotify for file watching, TanStack Query/Router/Table, shadcn/ui + Tailwind, CodeMirror 6.

### Two runtime modes

```
Desktop mode:  React → Wails IPC → Go handlers
Browser mode:  React → HTTP API (Chi) → Go handlers
```

The frontend uses a `lib/api.ts` transport abstraction — detects `window.__WAILS__` and routes calls to either Wails auto-generated bindings or `fetch()`. TanStack Query sits on top and is transport-agnostic.

### Planned Go package layout

```
main.go / app.go             # Wails entry and app lifecycle
backend/claude/              # File system readers/writers per domain (fs, settings, skills, hooks, commands, plans, sessions, usage)
backend/db/                  # SQLite init, Goose migrations, sqlc-generated queries
backend/api/                 # App struct with Wails bindings, Chi routes, domain handlers, optional bearer auth middleware
frontend/src/lib/api.ts      # Transport abstraction
frontend/src/hooks/          # TanStack Query hooks per domain
frontend/src/pages/          # One page per section (Plans, Sessions, Settings, Skills, Hooks, Commands, Usage)
frontend/src/components/ui/  # shadcn/ui components
```

### Data storage

SQLite at `~/.claudepad/claudepad.db` stores only enrichment metadata (friendly names, tags, notes, project registry). The `.claude/` files on disk are always the source of truth — Claudepad never renames or deletes them.

### Key design rules

- **Disabled hooks** are moved to a `_disabled_hooks` key in `settings.json` (not deleted) — Claude Code ignores unknown keys.
- **Plan todo progress** is computed on-the-fly from markdown `- [x]` / `- [ ]` syntax; no SQLite state for todos.
- **Wails bindings** in `backend/api/app.go` are thin wrappers — all logic lives in the domain packages under `backend/`.
- **Browser mode** is launched with `claudepad --browser --port 5173`; requires the full REST layer (not just Wails IPC).
