# `backend/claude/folders`

Generic folder management backed by the SQLite `folders` table.

## Overview

Folders are logical groupings stored in the database — they have no filesystem representation. An `entity_type` discriminator (`"note"`, `"plan"`, etc.) namespaces them so different entity types can share folder names without collision.

Currently only notes are wired up (`entity_type = "note"`).

## Data model

```
folders
  id          TEXT PRIMARY KEY      -- UUID
  entity_type TEXT NOT NULL         -- 'note', 'plan', …
  name        TEXT NOT NULL
  pinned      INTEGER DEFAULT 0     -- 1 = pinned
  created_at  DATETIME
  UNIQUE(entity_type, name)
```

Notes reference a folder via `file_metadata.folder_id` (empty string = uncategorized).

## Sort order

`pinned DESC, name ASC` — returned by `GetFoldersByType` at the DB layer.

## Key functions

| Function | Description |
|---|---|
| `ReadFolders(q, entityType)` | Returns all folders for the given type, pinned first |
| `CreateFolder(q, entityType, name)` | Creates a folder with a UUID, returns the new `Folder` |
| `RenameFolder(q, id, name)` | Updates the display name |
| `SetFolderPinned(q, id, pinned)` | Toggles pinned status |
| `DeleteFolder(q, id)` | Clears all note assignments then deletes the folder |

## Testability

Tests use an in-memory SQLite database (`":memory:"`), creating the `folders` and `file_metadata` tables inline so they run without the full Goose migration stack.
