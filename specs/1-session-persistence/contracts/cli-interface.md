# CLI Interface Contract: Session Persistence

**Feature**: 1-session-persistence
**Date**: 2026-02-22

## Commands

### Default: Start New Session (interactive mode)

```
dexter
```

**Behavior**: Starts a new interactive session with an auto-generated session ID. Session ID is displayed at startup. All exchanges are persisted to disk.

**Output** (startup banner includes session ID):
```
Session: a7k3m9x2
Model: claude-sonnet-4-20250514 (Anthropic)
>
```

### Resume Session

```
dexter --session <id>
```

**Parameters**:
- `<id>`: 8-character alphanumeric session ID

**Success behavior**: Loads the specified session's conversation history. Displays prior exchanges in the chat log. Resumes saving new exchanges to the same session.

**Output** (startup banner):
```
Session: a7k3m9x2 (resumed, 3 exchanges)
Model: claude-sonnet-4-20250514 (Anthropic)
>
```

**Error: Session not found**:
```stderr
Error: Session "xyz12345" not found.

Available sessions:
  a7k3m9x2  2026-02-22 14:30  "What is AAPL's P/E ratio?"
  b3n8p2q1  2026-02-21 09:15  "Compare MSFT and GOOGL revenue..."

Use --list-sessions to see all sessions.
```
Exit code: 1

### List Sessions

```
dexter --list-sessions
```

**Output (human-readable, default)**:
```
ID        Created              Last Active          Exchanges  Preview
a7k3m9x2  2026-02-22 14:30:00  2026-02-22 15:45:00  3          What is AAPL's P/E ratio?
b3n8p2q1  2026-02-21 09:15:00  2026-02-21 10:30:00  7          Compare MSFT and GOOGL revenue...
c9d1f4g6  2026-02-20 11:00:00  2026-02-20 11:05:00  1          Show me TSLA's financials

3 sessions found.
```

**Output (JSON, when piped or with --json)**:
```json
{
  "sessions": [
    {
      "id": "a7k3m9x2",
      "createdAt": "2026-02-22T14:30:00.000Z",
      "updatedAt": "2026-02-22T15:45:00.000Z",
      "exchangeCount": 3,
      "model": "claude-sonnet-4-20250514",
      "provider": "anthropic",
      "firstQuery": "What is AAPL's P/E ratio?",
      "lastQuery": "How does that compare to the sector average?"
    }
  ],
  "count": 1
}
```

**No sessions**:
```
No saved sessions found.
```
Exit code: 0

### Delete Session

```
dexter --delete-session <id>
```

**Parameters**:
- `<id>`: 8-character alphanumeric session ID

**Confirmation prompt** (interactive):
```
Delete session a7k3m9x2? (3 exchanges, last active 2026-02-22 15:45)
Type 'yes' to confirm:
```

**Success**:
```
Session a7k3m9x2 deleted.
```
Exit code: 0

**Error: Session not found**:
```stderr
Error: Session "xyz12345" not found.
```
Exit code: 1

## Flag Summary

| Flag | Argument | Description |
|------|----------|-------------|
| `--session` | `<id>` | Resume an existing session by ID |
| `--list-sessions` | (none) | List all saved sessions |
| `--delete-session` | `<id>` | Delete a session by ID |
| `--json` | (none) | Output in JSON format (for --list-sessions) |

## Exit Codes

| Code | Meaning |
|------|---------|
| 0 | Success |
| 1 | Invalid argument or session not found |

## Interaction with Existing Features

- **Model switching** (`/model` command): Works normally within a session. New model is used for subsequent exchanges. Session metadata records the model at creation time; each exchange records the model used.
- **Scratchpad**: Continues to write per-query JSONL files as before. Session persistence is additive and does not modify scratchpad behavior.
- **LongTermChatHistory**: Continues to work as before for input history navigation. Session persistence adds a parallel storage system for richer context.
- **No flag (default)**: Behavior changes from current (no session tracking) to new (auto-create session). This is the only behavioral change to the default flow.
