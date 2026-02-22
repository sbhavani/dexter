# CLI Interface Contract: --json Flag

**Feature**: `--json` flag for structured output
**Date**: 2026-02-22

## Command Syntax

```
bun start --json [QUERY]
bun start --json < input.txt
echo "QUERY" | bun start --json
```

## Arguments

| Argument | Position | Required | Description |
| -------- | -------- | -------- | ----------- |
| `--json` | Any      | Yes      | Enables JSON output mode (flag, no value) |
| `QUERY`  | After `--json` or first positional | No | Research query text. If omitted, reads from stdin. |

## Behavior Matrix

| `--json` | Query Arg | Stdin Piped | Behavior                              | Exit Code |
| -------- | --------- | ----------- | ------------------------------------- | --------- |
| No       | -         | -           | Launch interactive TUI (existing)     | 0         |
| Yes      | Present   | -           | Execute query, output JSON to stdout  | 0/1       |
| Yes      | Absent    | Yes         | Read stdin, execute, output JSON      | 0/1       |
| Yes      | Absent    | No (TTY)    | Output JSON error: NO_QUERY           | 1         |

## Output Streams

| Stream | Content                                    |
| ------ | ------------------------------------------ |
| stdout | Single JSON object (see json-response.schema.json) |
| stderr | Optional diagnostic/progress messages      |

## Exit Codes

| Code | Meaning           |
| ---- | ----------------- |
| 0    | Successful query  |
| 1    | Any error         |

## Examples

### Success

```bash
$ bun start --json "What is Apple's revenue?"
{
  "status": "success",
  "query": "What is Apple's revenue?",
  "answer": "Apple's revenue for fiscal year 2025 was...",
  "tools": [
    { "name": "financial_search", "args": { "query": "Apple revenue" }, "result": "..." }
  ],
  "scratchpadFile": ".dexter/scratchpad/2026-02-22-143045_a1b2c3d4e5f6.jsonl",
  "metadata": {
    "model": "claude-sonnet-4-6",
    "iterations": 2,
    "totalTimeMs": 8500,
    "tokenUsage": { "inputTokens": 1200, "outputTokens": 800, "totalTokens": 2000 }
  }
}
```

### Error (No Query)

```bash
$ bun start --json
{
  "status": "error",
  "query": "",
  "answer": "",
  "tools": [],
  "scratchpadFile": "",
  "metadata": { "model": "", "iterations": 0, "totalTimeMs": 0 },
  "error": { "code": "NO_QUERY", "message": "No query provided. Pass a query as an argument or pipe via stdin." }
}
```

### Pipeline Usage

```bash
$ bun start --json "What is Apple's revenue?" | jq '.answer'
"Apple's revenue for fiscal year 2025 was..."

$ bun start --json "What is Apple's revenue?" 2>/dev/null | jq '.tools | length'
3
```
