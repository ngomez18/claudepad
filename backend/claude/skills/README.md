# skills

Reads `~/.claude/skills/` skill directories.

Each subdirectory (or symlink to a directory) is a skill. The skill's content is read from `SKILL.md` inside the directory. YAML frontmatter with `name`, `description`, and `allowed-tools` keys is supported. If frontmatter is absent, `name` falls back to the directory entry name and `description` to the first non-empty content line.

Symlinks are resolved before looking up `SKILL.md`. If `SKILL.md` is missing the skill is still included with empty content.

Skills are sorted newest-first by `SKILL.md` modification time (or directory mtime if `SKILL.md` is absent).
