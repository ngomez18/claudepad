# package plans

Reads markdown plan files from `~/.claude/plans/` and manages their metadata in SQLite.

## Source files

```
~/.claude/plans/*.md
```

Each `.md` file is one plan. The filename (minus `.md`) is the plan's default display name.

## Parsing

Files are read in full with `os.ReadFile`. Two regex passes extract todo progress on-the-fly:

| Pattern | Meaning |
|---|---|
| `- [ ]` | Unchecked todo item |
| `- [x]` or `- [X]` | Checked todo item |

`TodoDone` and `TodoTotal` are computed from match counts — no SQLite state is involved.

`WordCount` is computed with `strings.Fields` on the raw markdown content.

## Sort order

`ReadPlans` applies a two-level sort after DB enrichment:

1. **Pinned first** — pinned plans always appear at the top.
2. **Modified time descending** — newest first within each pin group.

The internal `readPlansFrom` helper applies only the modified-time sort (no DB access).

## Metadata (via SQLite)

All mutable metadata is stored in the `file_metadata` table (`file_type = 'plan'`). Plan files on disk are **never modified**.

### `PlanMeta` struct

| Field | Type | Description |
|---|---|---|
| `Pinned` | `bool` | Pin to top of list |
| `ProjectID` | `string` | FK to `projects.id` or `""` |
| `Tags` | `[]string` | Free-form tags (stored as JSON array) |
| `Notes` | `string` | Private notes (not shown in plan content) |
| `Archived` | `bool` | Soft-hide from default list view |

### Functions

**`ReadPlans(db *sql.DB) ([]Plan, error)`**

Reads all `.md` files from `~/.claude/plans/`, enriches each with metadata from the `file_metadata` table, and returns them sorted by pin → priority → modified time.

**`SetPlanName(db *sql.DB, path, name string) error`**

Upserts a friendly display name for a plan. Pass an empty string to clear the name and revert to the filename-derived default. Never touches `PlanMeta` fields.

**`SetPlanMeta(db *sql.DB, path string, meta PlanMeta) error`**

Upserts all `PlanMeta` fields for a plan. Never modifies `friendly_name` — use `SetPlanName` for that.

## DB schema (relevant columns)

All plan metadata is stored in the `file_metadata` table. Relevant columns:

```sql
pinned     INTEGER NOT NULL DEFAULT 0
project_id TEXT    NOT NULL DEFAULT ''
tags       TEXT    NOT NULL DEFAULT '[]'
notes      TEXT    NOT NULL DEFAULT ''
archived   INTEGER NOT NULL DEFAULT 0
```

## No file writes

This package never renames, moves, or deletes plan files. Claudepad stores display metadata in SQLite only; `.claude/` files are always the source of truth.
