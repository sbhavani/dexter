# Quickstart: JSON Output Mode

**Feature Branch**: `1-json-output`

---

## What This Feature Does

Adds a `--json` flag to Dexter that outputs structured JSON to stdout instead of rendering the interactive TUI. This enables using Dexter in scripts, pipelines, and automated workflows.

## Usage Examples

### Basic query via argument

```bash
dexter --json "What is Apple's current P/E ratio?"
```

### Piped query via stdin

```bash
echo "Get Tesla's revenue for the last 3 years" | dexter --json
```

### Pipeline with jq

```bash
dexter --json "What is AAPL's market cap?" | jq '.answer'
```

### Specify model

```bash
dexter --json --model claude-sonnet-4-20250514 "Analyze NVDA"
```

### Error handling in scripts

```bash
result=$(dexter --json "What is Apple's PE?")
success=$(echo "$result" | jq -r '.success')

if [ "$success" = "true" ]; then
  echo "Answer: $(echo "$result" | jq -r '.answer')"
else
  echo "Error: $(echo "$result" | jq -r '.error')" >&2
  exit 1
fi
```

## Output Format

### Success

```json
{
  "success": true,
  "query": "What is Apple's current P/E ratio?",
  "answer": "Apple's current P/E ratio is 28.5...",
  "model": "gpt-5.2",
  "toolCalls": [
    {
      "tool": "get_company_facts",
      "args": { "ticker": "AAPL" },
      "result": "..."
    }
  ],
  "iterations": 2,
  "duration": 3450,
  "tokenUsage": {
    "inputTokens": 1200,
    "outputTokens": 450,
    "totalTokens": 1650
  }
}
```

### Error

```json
{
  "success": false,
  "query": "",
  "error": "No query provided. Pass a query as an argument or pipe via stdin."
}
```

## Exit Codes

| Code | Meaning |
|------|---------|
| 0 | Query processed successfully |
| 1 | Runtime error (model failure, network error) |
| 2 | Invalid usage (no query, bad flags) |

## Key Files

| File | Purpose |
|------|---------|
| `src/index.tsx` | Entry point — parses `--json` flag and branches execution |
| `src/cli/parse-args.ts` | Argument parser |
| `src/cli/json-mode.ts` | JSON mode execution handler |
| `src/agent/types.ts` | `JsonOutput` type definitions |

## Running Tests

```bash
bun test src/cli/parse-args.test.ts
bun test src/cli/json-mode.test.ts
```

## Development Notes

- JSON mode completely bypasses the TUI — no pi-tui dependency in this path
- All tools are auto-approved in JSON mode (no interactive prompts)
- Scratchpad logging still works — check `.dexter/scratchpad/` for debug JSONL
- stdout contains ONLY the JSON object; all diagnostics go to stderr
