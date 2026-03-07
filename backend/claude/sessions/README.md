# package sessions

Reads Claude Code session files from `~/.claude/projects/`.

## Source files

```
~/.claude/projects/
  {encoded-project-path}/          ← one dir per project
    {uuid}.jsonl                   ← one file per session
    {uuid}/subagents/              ← subagent sidechains (skipped)
      agent-{id}.jsonl
    agent-{id}.jsonl               ← top-level agent files (skipped)
```

**Encoded project path:** the absolute project path with every `/` replaced by `-`, e.g. `/Users/ngomez/code/claudepad` → `-Users-ngomez-code-claudepad`. Decoding for display is done in the frontend (replace all `-` with `/`, take the last path segment).

## JSONL format

Each line is one JSON object. The relevant `type` values are:

| `type` | Meaning |
|---|---|
| `"user"` | A user turn. `message.content` is either a **plain string** (real prompt) or an **array** (tool results — skip). |
| `"assistant"` | An assistant turn. `message.content` is an array of content blocks. |
| `"progress"`, `"file-history-snapshot"`, `"queue-operation"` | Infrastructure records — skipped entirely. |

Top-level fields present on most lines: `sessionId`, `timestamp` (RFC3339 with ms), `gitBranch`, `cwd`, `slug`, `isSidechain`.

### Slug

A whimsical human-readable name (e.g. `"mossy-purring-lamport"`) assigned by Claude Code. It first appears after the session is established — not on line 1. **Slugs are not unique:** different sessions, even across projects, may share the same slug. `sessionId` (UUID) is the true unique identifier.

### Assistant content blocks

```json
{ "type": "text",     "text": "..."              }   → appended to Text
{ "type": "tool_use", "name": "Read", "id": "…"  }   → name collected into Tools
{ "type": "thinking", "thinking": "…"             }   → skipped
```

## Parsing strategy

Files are scanned line-by-line with `bufio.Scanner` (4 MB buffer — lines can be large due to cached content in tool results). The full file is never loaded into memory at once.

**`ReadSessions`** (metadata only):
- Counts user text turns (`MessageCount`)
- Captures first user text as `Snippet` (truncated to 120 runes)
- Takes first non-empty `slug`, `gitBranch`, `cwd`, `sessionId` seen
- Derives `StartedAt` from first timestamp, `DurationSecs` from last − first

**`ReadTranscript`** (full parse, on demand):
- User lines with string content → `{role:"user", text, timestamp}`
- Assistant lines → text blocks joined with `\n`, tool names collected → `{role:"assistant", text, tools, timestamp}`
- Tool result arrays (user lines where content is an array) are skipped — they are noisy and not useful to display

## No writes

This package is read-only. Claude Code owns all `.jsonl` files; Claudepad never modifies them.
