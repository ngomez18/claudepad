# package usage

Reads `~/.claude/stats-cache.json`, which Claude Code pre-computes and updates periodically.

## Source file

```
~/.claude/stats-cache.json   (schema version 2)
```

## Parsing

The file is a single JSON object — no streaming needed. It is read with `os.ReadFile` and unmarshalled directly into `StatsCache`.

Key fields:

| Field | Notes |
|---|---|
| `lastComputedDate` | Date-only string (`YYYY-MM-DD`), no time component. Used to show a "stale" indicator when it doesn't match today. |
| `dailyActivity` | Array of per-day `{date, messageCount, sessionCount, toolCallCount}` |
| `dailyModelTokens` | Array of per-day `{date, tokensByModel}` — used for the bar chart |
| `modelUsage` | Map of model ID → token/cost breakdown |

## No writes

This package is read-only. Claude Code owns `stats-cache.json`; Claudepad never modifies it.
