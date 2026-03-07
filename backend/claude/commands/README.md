# commands

Reads `~/.claude/commands/*.md` command files.

Each `.md` file is a Claude Code slash command. Files may include optional YAML frontmatter with `name` and `description` keys. If frontmatter is absent, `name` falls back to the filename (without `.md`) and `description` falls back to the first non-empty content line.

Commands are sorted newest-first by modification time.

`WriteCommand(path, content)` writes updated content back to a command file, validating that the path is inside the commands directory.
