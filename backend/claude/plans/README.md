# package plans

Reads markdown plan files from `~/.claude/plans/`.

## Source files

```
~/.claude/plans/*.md
```

Each `.md` file is one plan. The filename (minus `.md`) is the plan's display name.

## Parsing

Files are read in full with `os.ReadFile`. Two regex passes extract todo progress on-the-fly:

| Pattern | Meaning |
|---|---|
| `- [ ]` | Unchecked todo item |
| `- [x]` or `- [X]` | Checked todo item |

`TodoDone` and `TodoTotal` are computed from match counts — no SQLite state is involved.

Plans are sorted newest-first by file modification time (`os.FileInfo.ModTime`).

## No writes

This package is read-only. Claude Code creates and updates plan files; Claudepad never modifies them.
