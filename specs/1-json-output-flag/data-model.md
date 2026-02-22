# Data Model: JSON Output Flag

**Feature**: `--json` flag for structured output
**Branch**: `1-json-output-flag`
**Date**: 2026-02-22

## Entities

### JsonResponse (Output)

The top-level JSON object written to stdout on successful execution.

| Field          | Type                     | Required | Description                                             |
| -------------- | ------------------------ | -------- | ------------------------------------------------------- |
| status         | `"success"` \| `"error"` | Yes      | Outcome of the query execution                          |
| query          | string                   | Yes      | The original user query                                 |
| answer         | string                   | Yes      | Final answer text (empty string `""` on error)          |
| tools          | ToolRecord[]             | Yes      | List of tools invoked during research (empty on error)  |
| scratchpadFile | string                   | Yes      | Relative path to the scratchpad JSONL file              |
| metadata       | ResponseMetadata         | Yes      | Execution metadata (model, timing, tokens)              |
| error          | ErrorDetail \| undefined | No       | Present only when `status === "error"`                  |

### ToolRecord (Nested)

A single tool invocation record within the response.

| Field  | Type                     | Required | Description                      |
| ------ | ------------------------ | -------- | -------------------------------- |
| name   | string                   | Yes      | Tool name (e.g., `financial_search`, `web_search`) |
| args   | Record<string, unknown>  | Yes      | Arguments passed to the tool     |
| result | string                   | Yes      | Stringified tool result          |

### ResponseMetadata (Nested)

Execution statistics for the query.

| Field        | Type              | Required | Description                                  |
| ------------ | ----------------- | -------- | -------------------------------------------- |
| model        | string            | Yes      | Model ID used for the query                  |
| iterations   | number            | Yes      | Agent loop iterations completed              |
| totalTimeMs  | number            | Yes      | Total wall-clock time in milliseconds        |
| tokenUsage   | TokenUsage \| undefined | No | Token consumption breakdown (when available) |

### TokenUsage (Nested — existing type)

Already defined in `src/agent/types.ts`. Reused as-is.

| Field        | Type   | Required | Description              |
| ------------ | ------ | -------- | ------------------------ |
| inputTokens  | number | Yes      | Prompt tokens consumed   |
| outputTokens | number | Yes      | Completion tokens generated |
| totalTokens  | number | Yes      | Sum of input + output    |

### ErrorDetail (Nested)

Error information for failed queries.

| Field   | Type   | Required | Description                                        |
| ------- | ------ | -------- | -------------------------------------------------- |
| code    | string | Yes      | Machine-readable error code (e.g., `NO_QUERY`, `AGENT_ERROR`, `PROVIDER_ERROR`) |
| message | string | Yes      | Human-readable error description                   |

## Error Codes

| Code              | Description                                                |
| ----------------- | ---------------------------------------------------------- |
| `NO_QUERY`        | No query provided via argument or stdin                    |
| `AGENT_ERROR`     | Agent execution failed (tool error, max iterations, etc.)  |
| `PROVIDER_ERROR`  | LLM provider connection or authentication failure          |
| `CONFIG_ERROR`    | Missing or invalid configuration (e.g., no API key)        |
| `UNKNOWN_ERROR`   | Unexpected error that doesn't fit other categories         |

## Validation Rules

- `status` must be exactly `"success"` or `"error"`
- `query` must be a non-empty string (validated before agent execution)
- `answer` must be a string; empty `""` is valid for error responses
- `tools` must be an array (can be empty)
- `scratchpadFile` must be a valid relative path starting with `.dexter/scratchpad/`
- `error` must be present when `status === "error"` and absent when `status === "success"`
- `metadata.totalTimeMs` must be a positive integer
- `metadata.iterations` must be a non-negative integer

## Relationships

```
JsonResponse
├── tools: ToolRecord[] (0..N)
├── metadata: ResponseMetadata (1)
│   └── tokenUsage?: TokenUsage (0..1)
└── error?: ErrorDetail (0..1)
```

## State Transitions

The JSON runner follows a linear execution path:

```
INIT → PARSE_ARGS → READ_QUERY → VALIDATE → EXECUTE_AGENT → BUILD_RESPONSE → OUTPUT → EXIT

Where:
  PARSE_ARGS: Extract --json flag and query from argv/stdin
  READ_QUERY: Read from argv positional or stdin
  VALIDATE:   Ensure query is non-empty → error response if not
  EXECUTE_AGENT: Run Agent.run() → collect DoneEvent
  BUILD_RESPONSE: Map DoneEvent + scratchpad path → JsonResponse
  OUTPUT:     JSON.stringify() → stdout
  EXIT:       process.exit(0) or process.exit(1)
```
