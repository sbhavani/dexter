# Implementation Plan: JSON Output Flag

**Feature**: `--json` flag for structured output
**Branch**: `1-json-output-flag`
**Status**: Ready for implementation
**Date**: 2026-02-22

## Technical Context

### Codebase Architecture

| Component | Location | Role |
| --------- | -------- | ---- |
| Entry point | `src/index.tsx` | Loads dotenv, calls `runCli()` |
| TUI runner | `src/cli.ts` | Initializes pi-tui, renders components, handles input |
| Agent | `src/agent/agent.ts` | Core agent loop: LLM calls → tool execution → final answer |
| Agent types | `src/agent/types.ts` | `AgentEvent`, `DoneEvent`, `AgentConfig`, `TokenUsage` |
| Run context | `src/agent/run-context.ts` | `RunContext` with scratchpad + token counter |
| Scratchpad | `src/agent/scratchpad.ts` | Append-only JSONL log in `.dexter/scratchpad/` |
| Tool registry | `src/tools/registry.ts` | Registers all tools per model |
| Tool executor | `src/agent/tool-executor.ts` | Executes tools with approval flow |
| AgentRunner controller | `src/controllers/agent-runner.ts` | TUI-coupled agent orchestration |
| Config | `src/utils/config.ts` | Loads `.dexter/settings.json` |
| Model | `src/utils/model.ts` | Model selection, provider routing |
| Logger | `src/utils/logger.ts` | Logging utility |

### Key Interfaces

**`Agent.run(query, history?) → AsyncGenerator<AgentEvent>`** — The agent is already decoupled from the TUI. It yields events (`thinking`, `tool_start`, `tool_end`, `answer_start`, `done`) that any consumer can process. The `DoneEvent` contains: `answer`, `toolCalls`, `iterations`, `totalTime`, `tokenUsage`.

**`AgentConfig`** — Accepts `model`, `maxIterations`, `signal`, `requestToolApproval`, `sessionApprovedTools`. The JSON runner can provide its own config without touching the TUI controller.

**`Scratchpad`** — Creates JSONL files automatically. The filepath is private — needs a public getter.

### Dependencies Identified

| Dependency | Status | Impact |
| ---------- | ------ | ------ |
| `Agent` class | Stable, decoupled | Direct reuse — no changes needed |
| `Scratchpad` class | Stable | Minor addition: `getFilePath()` getter |
| `loadConfig()` / `getSetting()` | Stable | Reuse for model/provider selection |
| `Zod` (schema validation) | Already installed (^4.1.13) | Use for response schema |
| `process.argv` | Runtime built-in | No new dependencies |
| `Bun.stdin` | Runtime built-in | No new dependencies |

### Technology Choices

| Choice | Technology | Justification |
| ------ | ---------- | ------------- |
| Runtime | Bun (existing) | No change |
| Language | TypeScript (existing) | No change |
| Arg parsing | `process.argv` direct | YAGNI — single boolean flag |
| Schema validation | Zod (existing dep) | Ensures contract compliance |
| Test framework | Bun test (existing) | No change |

## Constitution Check

### Principle I: Test-First (NON-NEGOTIABLE)

**Status**: COMPLIANT

Tests must be written before implementation:
- `json-schema.test.ts` — validates Zod schemas and response builders
- `json-runner.test.ts` — validates end-to-end JSON mode behavior
- Tests cover: valid JSON output, error responses, exit codes, scratchpad creation, stdout cleanliness

### Principle II: CLI-First Interface

**Status**: COMPLIANT — This feature directly implements the constitution's mandate: "Support both JSON (for scripting) and human-readable formats."

The `--json` flag follows the text in/out protocol:
- Input: stdin/args
- Output: stdout (JSON)
- Errors: stderr (diagnostics)

### Principle III: Observability

**Status**: COMPLIANT

FR-7 explicitly requires scratchpad compatibility. The `Agent.run()` already creates scratchpad entries. JSON mode reuses the same agent, so scratchpad logging is automatic. The scratchpad path is included in the JSON response.

### Principle IV: Safety & Loop Prevention

**Status**: COMPLIANT

The agent's existing loop detection and step limits (`maxIterations: 10`) apply equally in JSON mode. Tool approval is auto-approved (documented assumption), but the loop prevention, tool limits, and query similarity detection remain active.

### Principle V: Simplicity (YAGNI)

**Status**: COMPLIANT

- 2 new files (`json-runner.ts`, `json-schema.ts`)
- 1 minor modification (`scratchpad.ts` — add getter)
- 1 routing change (`index.tsx` — 5-line conditional)
- No new dependencies
- No new abstractions or frameworks
- Separate runner avoids complicating existing TUI code

## Implementation Strategy

### Phase 1: Schema & Scratchpad (Foundation)

**Files**: `src/json-schema.ts`, `src/agent/scratchpad.ts`

1. Define Zod schemas for `JsonResponse`, `ToolRecord`, `ResponseMetadata`, `ErrorDetail`
2. Implement `buildSuccessResponse()` and `buildErrorResponse()` helper functions
3. Add `getFilePath(): string` to `Scratchpad` class
4. Write tests for schema validation and response builders

**Test-first**: `src/__tests__/json-schema.test.ts`

### Phase 2: JSON Runner (Core)

**Files**: `src/json-runner.ts`

1. Implement `runJson(args: string[])`:
   - Parse query from args (first non-flag positional) or stdin
   - Detect TTY vs piped stdin
   - Load model config from settings
   - Create `Agent` with auto-approve config
   - Iterate `agent.run()`, capture `DoneEvent`
   - Build `JsonResponse` using schema helpers
   - Write to stdout via `console.log(JSON.stringify(response))`
   - Call `process.exit()` with 0 or 1

2. Error handling:
   - No query → `NO_QUERY` error response
   - Agent throws → `AGENT_ERROR` error response
   - Provider error → `PROVIDER_ERROR` error response
   - Config error → `CONFIG_ERROR` error response
   - Catch-all → `UNKNOWN_ERROR` error response

**Test-first**: `src/__tests__/json-runner.test.ts`

### Phase 3: Entry Point Routing (Integration)

**Files**: `src/index.tsx`

1. After `dotenv.config()`, parse `process.argv` for `--json` flag
2. If `--json` present: import and call `runJson()` with remaining args
3. If absent: call `runCli()` as before

**Test-first**: Integration tests verifying routing behavior

### Phase 4: Validation & Edge Cases

1. Verify stdout contains only JSON (no leaked console.log, TUI artifacts)
2. Verify stderr receives diagnostic output
3. Verify scratchpad file is created with correct entries
4. Verify exit codes match expectations
5. Pipeline test: `bun start --json "query" | jq '.answer'`

## File Change Summary

| File | Action | Description |
| ---- | ------ | ----------- |
| `src/json-schema.ts` | CREATE | Zod schemas + response builders |
| `src/json-runner.ts` | CREATE | Non-interactive JSON execution runner |
| `src/index.tsx` | MODIFY | Add `--json` flag detection and routing |
| `src/agent/scratchpad.ts` | MODIFY | Add `getFilePath()` public getter |
| `src/__tests__/json-schema.test.ts` | CREATE | Schema validation tests |
| `src/__tests__/json-runner.test.ts` | CREATE | JSON runner integration tests |

## Risk Assessment

| Risk | Likelihood | Impact | Mitigation |
| ---- | ---------- | ------ | ---------- |
| stdout pollution from dependencies | Low | High | Test: redirect stderr, validate JSON parse |
| Agent errors not caught | Low | Medium | Wrap entire runner in try/catch with UNKNOWN_ERROR fallback |
| stdin hangs in TTY mode | Medium | Medium | Check `process.stdin.isTTY` before reading |
| Scratchpad path unavailable on error | Low | Low | Use empty string for pre-agent errors |

## Design Artifacts

| Artifact | Path | Description |
| -------- | ---- | ----------- |
| Research | `specs/1-json-output-flag/research.md` | 8 research decisions with rationale |
| Data model | `specs/1-json-output-flag/data-model.md` | Entity definitions, validation rules, state transitions |
| JSON schema | `specs/1-json-output-flag/contracts/json-response.schema.json` | JSON Schema for response validation |
| CLI contract | `specs/1-json-output-flag/contracts/cli-interface.md` | Command syntax, behavior matrix, examples |
| Quickstart | `specs/1-json-output-flag/quickstart.md` | Architecture overview, flow diagram, file guide |
