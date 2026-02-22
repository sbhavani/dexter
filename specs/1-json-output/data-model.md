# Data Model: JSON Output Mode

**Created**: 2026-02-22
**Feature Branch**: `1-json-output`

---

## Entities

### ParsedArgs

Represents the parsed command-line arguments.

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `json` | boolean | Yes | Whether `--json` flag is active |
| `model` | string | No | Model override via `--model` flag |
| `query` | string | No | Query from positional arguments |

**Validation rules**:
- `json` defaults to `false` if flag absent
- `model` must be a non-empty string if provided
- `query` is the concatenation of all non-flag arguments

---

### JsonSuccessOutput

Represents a successful query result in JSON mode.

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `success` | `true` (literal) | Yes | Always `true` for successful queries |
| `query` | string | Yes | The original user query |
| `answer` | string | Yes | The agent's final answer text |
| `model` | string | Yes | Model identifier used for the query |
| `toolCalls` | ToolCallRecord[] | Yes | List of tools invoked (may be empty) |
| `iterations` | number | Yes | Number of agent loop iterations |
| `duration` | number | Yes | Total processing time in milliseconds |
| `tokenUsage` | TokenUsage | No | Token consumption breakdown |

**Validation rules**:
- `success` must be literal `true`
- `query` and `answer` must be non-empty strings
- `iterations` must be a positive integer
- `duration` must be a non-negative number
- `toolCalls` may be an empty array but must not be null/undefined

---

### JsonErrorOutput

Represents a failed query result in JSON mode.

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `success` | `false` (literal) | Yes | Always `false` for failed queries |
| `query` | string | Yes | The original user query (empty string if unavailable) |
| `error` | string | Yes | Human-readable error description |

**Validation rules**:
- `success` must be literal `false`
- `error` must be a non-empty string
- `query` may be an empty string if the error occurred before query parsing

---

### ToolCallRecord (existing)

Represents a single tool invocation within a query. Already defined in agent types.

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `tool` | string | Yes | Tool name (e.g., `get_income_statements`) |
| `args` | Record<string, unknown> | Yes | Arguments passed to the tool |
| `result` | string | Yes | Stringified tool result |

---

### TokenUsage (existing)

Represents token consumption for a query. Already defined in agent types.

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `inputTokens` | number | Yes | Tokens consumed by input/prompt |
| `outputTokens` | number | Yes | Tokens consumed by model output |
| `totalTokens` | number | Yes | Sum of input and output tokens |

---

## Type Union

```
JsonOutput = JsonSuccessOutput | JsonErrorOutput
```

Discriminated union on the `success` field:
- `success: true` → `JsonSuccessOutput`
- `success: false` → `JsonErrorOutput`

---

## Relationships

```
ParsedArgs ──(drives)──> Execution Mode
  │
  └── json=true ──> runJsonMode()
       │
       ├── success ──> JsonSuccessOutput
       │                 ├── contains ToolCallRecord[]
       │                 └── contains TokenUsage?
       │
       └── failure ──> JsonErrorOutput
```

---

## State Transitions

### Query Execution States

```
[Start] ──> Parsing Args
  │
  ├── Invalid args ──> JsonErrorOutput (exit 2)
  │
  └── Valid args ──> Reading Query
       │
       ├── No query ──> JsonErrorOutput (exit 2)
       │
       └── Query found ──> Running Agent
            │
            ├── Agent error ──> JsonErrorOutput (exit 1)
            │
            └── Agent complete ──> JsonSuccessOutput (exit 0)
```
