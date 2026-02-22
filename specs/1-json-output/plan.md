# Implementation Plan: JSON Output Mode

**Version**: 1.0.0
**Status**: Draft
**Created**: 2026-02-22
**Feature Branch**: `1-json-output`
**Spec**: [spec.md](./spec.md)

---

## Technical Context

### Current Architecture

Dexter follows an event-driven agent loop with streaming generators:

```
src/index.tsx (entry point)
  → src/cli.ts :: runCli() (TUI orchestration)
    → AgentRunnerController (state management)
      → Agent.run() :: AsyncGenerator<AgentEvent> (core loop)
        → LLM calls + AgentToolExecutor (tool dispatch)
        → Scratchpad (JSONL persistence)
```

**Key observations:**
- Entry point (`src/index.tsx`) loads dotenv and calls `runCli()` with no argument parsing
- `runCli()` in `src/cli.ts` is tightly coupled to pi-tui TUI rendering — no non-interactive path exists
- Agent yields events via `AsyncGenerator<AgentEvent>` — output-agnostic by design
- `AgentRunnerController` accumulates events into `HistoryItem[]` — already JSON-serializable
- `DoneEvent` contains all final output data: answer, toolCalls, iterations, totalTime, tokenUsage
- No CLI argument parsing framework exists (raw `process.argv` used only in evals)
- Tool approval is interactive (Promise-based callback in TUI) — incompatible with non-interactive mode
- Model selection can be interactive — needs to default to configured model in JSON mode

### Technology Stack (from Constitution)

- **Runtime**: Bun (v1.0+) with TypeScript
- **LLM Framework**: LangChain (Anthropic, OpenAI, Google GenAI, Ollama)
- **TUI**: @mariozechner/pi-tui
- **Testing**: Bun test, Jest
- **Validation**: Zod for schema validation

### Files to Modify

| File | Change | Lines Added (est.) |
|------|--------|--------------------|
| `src/index.tsx` | Parse `--json` flag and query, branch execution | ~15 |
| `src/cli.ts` | Extract agent orchestration, add JSON mode path | ~80 |
| `src/agent/types.ts` | Add `JsonOutput` and `JsonErrorOutput` types | ~25 |

### Files to Create

| File | Purpose | Lines (est.) |
|------|---------|--------------|
| `src/cli/json-mode.ts` | Non-interactive JSON execution handler | ~120 |
| `src/cli/parse-args.ts` | Lightweight CLI argument parser | ~40 |
| `src/cli/json-mode.test.ts` | Tests for JSON output formatting and schema | ~100 |
| `src/cli/parse-args.test.ts` | Tests for argument parsing | ~60 |

### Files Unchanged

- `src/agent/agent.ts` — Agent is output-agnostic, yields events regardless of consumer
- `src/agent/scratchpad.ts` — Continues JSONL logging in both modes
- `src/agent/tool-executor.ts` — Tool execution logic unchanged; approval callback is injected
- `src/controllers/agent-runner.ts` — State management unchanged; used by both modes
- `src/model/llm.ts` — Model factory unchanged; JSON mode passes model config directly

---

## Constitution Check

### I. Test-First (NON-NEGOTIABLE)

**Status**: PASS

Tests will be written before implementation:
- Unit tests for argument parsing (`parse-args.test.ts`)
- Unit tests for JSON output serialization and schema validation (`json-mode.test.ts`)
- Integration test: JSON mode produces valid, parseable JSON for a mock agent run
- Error path tests: missing query, agent failure, invalid flags

### II. CLI-First Interface

**Status**: PASS — Feature directly fulfills this principle

Constitution states: *"Text in/out protocol: stdin/args → stdout, errors → stderr. Support both JSON (for scripting) and human-readable formats."*

This feature implements the JSON scripting format explicitly called out in the constitution.

### III. Observability

**Status**: PASS

Scratchpad JSONL logging is independent of output mode. The scratchpad creates files in `.dexter/scratchpad/` during agent execution regardless of whether TUI or JSON mode is active. No changes to scratchpad required.

### IV. Safety & Loop Prevention

**Status**: PASS

JSON mode inherits existing safety mechanisms:
- `maxIterations` limit in Agent (default: 10)
- Tool call limits tracked by Scratchpad (`canCallTool()`)
- AbortController for cancellation (timeout support)
- Loop detection in agent iteration logic

### V. Simplicity (YAGNI)

**Status**: PASS

Design follows minimal approach:
- No new dependencies (argument parsing uses built-in `process.argv`)
- No streaming/NDJSON — single buffered JSON object
- No new abstractions — reuses existing Agent and event system
- Two new files (`json-mode.ts`, `parse-args.ts`) with clear single responsibilities

---

## Design Decisions

### D1: Buffered Output vs. Streaming

**Decision**: Buffered — single JSON object output after completion.

**Rationale**: The spec explicitly states "Output is a single, complete JSON object (not streamed fragments)". Buffered output is simpler, atomic, and compatible with `jq` piping. Streaming NDJSON is listed as out of scope for future enhancement.

### D2: Argument Parsing — No New Dependency

**Decision**: Use raw `process.argv` parsing in a small utility module.

**Rationale**: Constitution principle V (Simplicity/YAGNI) discourages adding dependencies for simple tasks. The current codebase already uses raw `process.argv` in evals. Only two flags are needed (`--json`, `--model`), which doesn't justify a dependency like `commander` or `yargs`.

### D3: Tool Approval in JSON Mode

**Decision**: Auto-approve all tools when `--json` is active.

**Rationale**: The spec states "No user prompts for tool approval — tools requiring approval are auto-approved in JSON mode." Since JSON mode is non-interactive, there is no user to prompt. The `requestToolApproval` callback will return `'allow-once'` automatically.

### D4: JSON Output Schema — Zod Validated

**Decision**: Define output schema with Zod and validate before serialization.

**Rationale**: Constitution specifies Zod for schema validation. Validating output ensures NFR-1 (output validity) and NFR-2 (predictable schema). The Zod schema also serves as documentation.

### D5: Separation of JSON Mode Handler

**Decision**: Create `src/cli/json-mode.ts` as a separate module rather than adding JSON logic inline to `cli.ts`.

**Rationale**: `cli.ts` is already 409 lines and tightly coupled to TUI. Adding JSON mode inline would increase coupling. A separate module keeps TUI and JSON paths independent, making each easier to test and maintain.

### D6: Model Selection in JSON Mode

**Decision**: Use `--model` flag, fall back to environment variable, then to `DEFAULT_MODEL`.

**Rationale**: JSON mode cannot show interactive model selection. Resolution order: `--model <name>` flag → `DEXTER_MODEL` env var → saved config → `DEFAULT_MODEL` constant (`gpt-5.2`).

---

## Architecture

### Execution Flow

```
$ dexter --json "What is Apple's P/E ratio?"

src/index.tsx
  │ parseArgs(process.argv.slice(2))
  │   → { json: true, query: "What is Apple's P/E ratio?", model: undefined }
  │
  ├── json=false → runCli()  [existing TUI path, unchanged]
  │
  └── json=true → runJsonMode(query, options)  [new path]
         │
         ├── Validate query exists (or read from stdin)
         │
         ├── Create Agent.create({ model, maxIterations: 10,
         │     requestToolApproval: autoApprove })
         │
         ├── Collect events from agent.run(query)
         │     └── Buffer all AgentEvents
         │
         ├── On DoneEvent:
         │     └── Build JsonOutput from DoneEvent fields
         │
         ├── Validate output with Zod schema
         │
         ├── console.log(JSON.stringify(output, null, 2))
         │
         └── process.exit(0)

         On error:
         ├── Build JsonErrorOutput
         ├── console.log(JSON.stringify(errorOutput, null, 2))
         └── process.exit(1)
```

### Module Dependency Graph

```
src/index.tsx
  ├── src/cli.ts (existing, unchanged)
  ├── src/cli/parse-args.ts (new)
  └── src/cli/json-mode.ts (new)
       ├── src/agent/agent.ts (existing, unchanged)
       ├── src/agent/types.ts (existing, extended with JsonOutput types)
       └── zod (existing dependency)
```

### Type Design

```typescript
// In src/agent/types.ts (additions)

interface JsonSuccessOutput {
  success: true;
  query: string;
  answer: string;
  model: string;
  toolCalls: Array<{ tool: string; args: Record<string, unknown>; result: string }>;
  iterations: number;
  duration: number;
  tokenUsage?: TokenUsage;
}

interface JsonErrorOutput {
  success: false;
  query: string;
  error: string;
}

type JsonOutput = JsonSuccessOutput | JsonErrorOutput;
```

### Argument Parser Design

```typescript
// In src/cli/parse-args.ts

interface ParsedArgs {
  json: boolean;
  model?: string;
  query?: string;
}

function parseArgs(argv: string[]): ParsedArgs
```

Parsing rules:
- `--json` → sets `json: true`
- `--model <value>` → sets `model` to next argument
- Remaining non-flag arguments joined as `query`
- Unknown flags → ignored (forward compatibility)

### stdin Detection

```typescript
// In src/cli/json-mode.ts
async function readStdinQuery(): Promise<string | undefined> {
  if (process.stdin.isTTY) return undefined;  // No piped input
  // Read all of stdin until EOF
  const chunks: string[] = [];
  for await (const chunk of process.stdin) {
    chunks.push(chunk.toString());
  }
  return chunks.join('').trim() || undefined;
}
```

Query resolution order:
1. Positional argument from CLI (`dexter --json "query"`)
2. Piped stdin (`echo "query" | dexter --json`)
3. If neither: return JSON error with exit code 2

---

## Testing Strategy

### Test-First Approach (Constitution Principle I)

Tests are written before implementation. All tests use Bun test runner with Jest-compatible API.

#### 1. Argument Parser Tests (`src/cli/parse-args.test.ts`)

| Test Case | Input | Expected Output |
|-----------|-------|-----------------|
| No args | `[]` | `{ json: false, query: undefined }` |
| `--json` only | `['--json']` | `{ json: true, query: undefined }` |
| `--json` with query | `['--json', 'hello world']` | `{ json: true, query: 'hello world' }` |
| `--json` with `--model` | `['--json', '--model', 'claude-sonnet-4-20250514']` | `{ json: true, model: 'claude-sonnet-4-20250514' }` |
| Query without `--json` | `['hello']` | `{ json: false, query: 'hello' }` |
| Multi-word query | `['--json', 'What', 'is', "Apple's", 'PE?']` | `{ json: true, query: "What is Apple's PE?" }` |
| `--model` without value | `['--json', '--model']` | `{ json: true, model: undefined }` |

#### 2. JSON Output Tests (`src/cli/json-mode.test.ts`)

| Test Case | Scenario | Assertion |
|-----------|----------|-----------|
| Valid success output | Mock DoneEvent | Output matches `JsonSuccessOutput` Zod schema |
| Valid error output | Thrown error | Output matches `JsonErrorOutput` Zod schema |
| Output is valid JSON | Any output | `JSON.parse(stdout)` succeeds |
| No query error | Empty query | `{ success: false, error: "No query provided" }`, exit 2 |
| Schema stability | All fields | Required fields present, types correct |
| Tool calls serialized | DoneEvent with tools | `toolCalls` array matches source |
| Token usage optional | No usage data | `tokenUsage` field absent, not null |

---

## Risk Assessment

| Risk | Likelihood | Impact | Mitigation |
|------|-----------|--------|------------|
| Console.log pollution | Medium | High | Redirect all non-JSON output to stderr; validate stdout contains only JSON |
| LangChain logs to stdout | Medium | High | Ensure LangChain verbose mode is off; intercept console in JSON mode if needed |
| Tool approval blocks forever | Low | High | Auto-approve in JSON mode via callback injection |
| Large tool results overflow output | Low | Medium | Out of scope for v1; document as known limitation |
| Model API key missing | Medium | Medium | Return JSON error with clear message, exit code 1 |

---

## Implementation Order

1. **Tests first**: Write `parse-args.test.ts` and `json-mode.test.ts`
2. **Argument parser**: Implement `src/cli/parse-args.ts`
3. **Output types**: Add `JsonOutput` types to `src/agent/types.ts`
4. **JSON mode handler**: Implement `src/cli/json-mode.ts`
5. **Entry point integration**: Update `src/index.tsx` to branch on `--json`
6. **Stderr isolation**: Ensure all non-JSON output goes to stderr
7. **End-to-end verification**: Manual test with real agent query
