# Data Model: Session Persistence

**Feature**: 1-session-persistence
**Date**: 2026-02-22

## Entities

### SessionMetadata

Tracks identification and lifecycle information for a single session. Stored in the session index file.

| Field | Type | Description |
|-------|------|-------------|
| id | string (8-char alphanumeric) | Unique session identifier |
| createdAt | number (epoch ms) | Session creation timestamp |
| updatedAt | number (epoch ms) | Last activity timestamp |
| exchangeCount | number | Total completed exchanges in this session |
| model | string | Model ID used at session creation (e.g., "claude-sonnet-4-20250514") |
| provider | string | Provider ID at session creation (e.g., "anthropic") |
| firstQuery | string | First user query (truncated to 100 chars for listing preview) |
| lastQuery | string | Most recent user query (truncated to 100 chars for listing preview) |

**Validation rules**:
- `id`: 8 lowercase alphanumeric characters, must be unique across all sessions
- `createdAt`: Must be positive integer, set once at creation
- `updatedAt`: Must be >= `createdAt`, updated after each exchange
- `exchangeCount`: Non-negative integer, incremented after each completed exchange
- `firstQuery`, `lastQuery`: Truncated to 100 characters with "..." suffix if longer

### SessionIndex

Top-level container for all session metadata. Single file at `.dexter/sessions/index.json`.

| Field | Type | Description |
|-------|------|-------------|
| version | number | Schema version (starts at 1) |
| sessions | Record<string, SessionMetadata> | Map of session ID → metadata |

**Validation rules**:
- `version`: Must be 1 (future migrations can bump this)
- `sessions`: Keys must match the `id` field of each SessionMetadata value

### SessionExchange

A single user query + agent response pair. Stored as one JSONL line in the session's `history.jsonl`.

| Field | Type | Description |
|-------|------|-------------|
| id | string | Exchange identifier (timestamp-based) |
| timestamp | number (epoch ms) | When the exchange started |
| query | string | User's input query |
| answer | string | Agent's final answer (empty string if incomplete) |
| summary | string \| null | LLM-generated summary of the exchange |
| model | string | Model used for this specific exchange |
| status | "complete" \| "error" \| "interrupted" | Exchange completion status |
| duration | number \| null | Total time in ms for the exchange |
| tokenUsage | TokenUsageRecord \| null | Token consumption for the exchange |

**Validation rules**:
- `id`: Non-empty string
- `timestamp`: Positive integer
- `query`: Non-empty string
- `answer`: String (may be empty for incomplete exchanges)
- `status`: Must be one of the enumerated values
- Only exchanges with `status: "complete"` contribute to `exchangeCount`

### TokenUsageRecord

Token consumption metrics for a single exchange.

| Field | Type | Description |
|-------|------|-------------|
| inputTokens | number | Tokens in the prompt |
| outputTokens | number | Tokens in the response |
| totalTokens | number | Sum of input + output |

## Relationships

```
SessionIndex (1) ──contains──> (*) SessionMetadata
SessionMetadata (1) ──references──> (*) SessionExchange (via session directory)
SessionExchange (1) ──contains──> (0..1) TokenUsageRecord
```

## State Transitions

### Session Lifecycle

```
[New] ──create──> [Active] ──save exchange──> [Active] ──exit──> [Persisted]
[Persisted] ──resume──> [Active]
[Persisted] ──delete──> [Deleted]
```

### Exchange Lifecycle

```
[Started] ──query submitted──> [Processing]
[Processing] ──agent completes──> [Complete]
[Processing] ──error occurs──> [Error]
[Processing] ──user cancels──> [Interrupted]
[Processing] ──crash──> (not written to JSONL; prior exchanges intact)
```

## File Layout

```
.dexter/
├── sessions/
│   ├── index.json                    # SessionIndex
│   └── cli/
│       ├── {sessionId}/
│       │   └── history.jsonl         # SessionExchange entries (one per line)
│       └── {sessionId}/
│           └── history.jsonl
├── messages/
│   └── chat_history.json             # Existing LongTermChatHistory (unchanged)
├── scratchpad/
│   └── *.jsonl                       # Existing Scratchpad files (unchanged)
└── settings.json                     # Existing settings (unchanged)
```

## Schema Versioning

The `version` field in SessionIndex enables future migration:
1. On load, check `version` field
2. If version < current, run migration function
3. Save with updated version
4. Current version: 1
