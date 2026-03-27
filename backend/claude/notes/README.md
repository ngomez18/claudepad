# `backend/claude/notes`

Manages Claudepad's note files stored in `~/.claudepad/notes/`.

## Overview

Notes are markdown files created by users (via the `cpad-save-note` slash command or MCP server tool) to capture valuable Claude Code answers for future reference. Unlike plans, notes are owned by Claudepad — they are never auto-deleted.

## Note file format

```markdown
---
title: How streams work in Go
project: /Users/user/myproject
---

[note body — markdown]
```

Frontmatter is optional. If omitted, the title is derived from the filename.

## File location

- **Notes directory:** `~/.claudepad/notes/`
- **Filename convention:** `{YYYY-MM-DD}-{slug}.md`

## Data sources

| Field        | Source                                           |
|--------------|--------------------------------------------------|
| `title`      | DB `friendly_name` → frontmatter `title` → filename-derived |
| `project`    | Frontmatter `project`                            |
| `content`    | File body (after frontmatter)                    |
| `modifiedAt` | File mtime (RFC3339 UTC)                         |
| `wordCount`  | `len(strings.Fields(body))`                     |
| `tags`       | DB `file_metadata.tags` (JSON array)             |
| `pinned`     | DB `file_metadata.pinned`                        |
| `notes`      | DB `file_metadata.notes` (private annotations)  |
| `archived`   | DB `file_metadata.archived`                      |
| `folderId`   | DB `file_metadata.folder_id` (empty = uncategorized) |
| `folderName` | Resolved at read time from folder list passed to `ReadNotes` |

## Sort order

Pinned first → `modifiedAt` descending.

## Folder assignment

Notes are grouped into logical folders managed by `backend/claude/folders`. A note's folder is stored in `file_metadata.folder_id` (empty string = uncategorized). `ReadNotes` accepts a `map[folderID]folderName` index to resolve `folderName` without an extra DB round-trip.

## SQLite storage

Reuses the `file_metadata` table with `file_type = 'note'`. The `folder_id` column was added via the `folder_support` migration.

## Key functions

| Function | Description |
|---|---|
| `NotesDir()` | Returns `~/.claudepad/notes/`, creating if absent |
| `ReadNotes(q)` | Reads all note files, enriches from DB, sorts |
| `SetNoteTitle(q, path, title)` | Upserts `friendly_name` in DB; empty string clears |
| `SetNoteMeta(q, path, meta)` | Upserts tags, pinned, notes, archived, folderId |
| `InstallSaveNoteCommand()` | Writes `~/.claude/commands/cpad-save-note.md` if absent |

## Capture mechanisms

1. **Slash command** (`/cpad-save-note`): auto-installed by Claudepad on startup. Claude Code writes note files directly to `~/.claudepad/notes/`.
2. **MCP server** (`claudepad-mcp`): stdio JSON-RPC binary, exposes `save_note` tool. Configured in `~/.claude.json`.

## Testability

Functions use unexported `readNotesFrom(q, dir)` that accepts an arbitrary directory, enabling tests to work against temp directories rather than the real filesystem.
