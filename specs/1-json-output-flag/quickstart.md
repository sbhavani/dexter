# Quickstart: JSON Output Flag Implementation

**Feature**: `--json` flag for structured output
**Branch**: `1-json-output-flag`
**Date**: 2026-02-22

## Prerequisites

- Bun v1.0+ installed
- Project dependencies installed (`bun install`)
- At least one LLM provider API key configured (env var or `.dexter/settings.json`)

## Architecture Overview

```
src/index.tsx          ← Entry point: parse --json flag, route to json-runner or TUI
src/json-runner.ts     ← NEW: Non-interactive JSON execution
src/json-schema.ts     ← NEW: Zod schemas + response builder
src/agent/agent.ts     ← Existing: Core agent (no changes)
src/agent/scratchpad.ts ← Modified: Add getFilePath() getter
src/cli.ts             ← Existing: TUI code (no changes)
```

## Flow Diagram

```
bun start --json "query"
    │
    ▼
src/index.tsx
    │ Parse argv: detect --json flag
    │
    ├── --json present ──► src/json-runner.ts
    │                          │
    │                          ├── Read query (argv or stdin)
    │                          ├── Validate query (non-empty)
    │                          ├── Load model config
    │                          ├── Agent.create() + agent.run()
    │                          ├── Collect DoneEvent
    │                          ├── Build JsonResponse
    │                          ├── JSON.stringify() → stdout
    │                          └── process.exit(0 or 1)
    │
    └── --json absent ──► src/cli.ts (existing TUI)
```

## New Files

### `src/json-schema.ts`
- Zod schema for `JsonResponse`, `ToolRecord`, `ResponseMetadata`, `ErrorDetail`
- `buildSuccessResponse(query, doneEvent, scratchpadPath, model)` helper
- `buildErrorResponse(query, errorCode, message, scratchpadPath?, model?)` helper

### `src/json-runner.ts`
- `runJson(args: string[])` — main entry: parse query, execute agent, output JSON
- Reads query from args or stdin
- Creates agent with auto-approve tool approval
- Iterates `agent.run()` generator, captures `DoneEvent`
- Catches errors, builds error response
- Writes JSON to stdout, diagnostics to stderr
- Calls `process.exit()` with appropriate code

## Modified Files

### `src/index.tsx`
- Add argument parsing: check for `--json` in `process.argv`
- If `--json`: call `runJson()` instead of `runCli()`
- If no `--json`: existing behavior unchanged

### `src/agent/scratchpad.ts`
- Add `getFilePath(): string` public method returning `this.filepath`

## Test Files

### `src/__tests__/json-runner.test.ts`
- Query via argument produces valid JSON
- Query via stdin produces valid JSON
- No query produces error JSON with NO_QUERY code and exit 1
- Agent error produces error JSON with AGENT_ERROR code and exit 1
- Response matches Zod schema
- Scratchpad file is created and path is in response
- stdout contains only JSON (no TUI artifacts)

### `src/__tests__/json-schema.test.ts`
- `buildSuccessResponse()` produces valid schema
- `buildErrorResponse()` produces valid schema
- Error response has `error` field; success does not
- All required fields present

## Key Decisions

| Decision | Choice | Rationale |
| -------- | ------ | --------- |
| Arg parsing | Hand-rolled `process.argv` | YAGNI — one flag, no dependency needed |
| Runner | Separate `json-runner.ts` | Avoids TUI coupling, clean separation |
| Tool approval | Auto-approve `'allow-once'` | No interactive user in JSON mode |
| Exit codes | 0 success, 1 error | Simplest contract; error detail in JSON body |
| Schemas | Zod validation | Already a project dependency; ensures contract |
