# Research: JSON Output Flag

**Feature**: `--json` flag for structured output
**Branch**: `1-json-output-flag`
**Date**: 2026-02-22

## R1: CLI Argument Parsing Strategy

**Decision**: Use `process.argv` directly with a minimal hand-rolled parser.

**Rationale**: The project constitution mandates YAGNI (Principle V). Dexter currently has zero CLI flags in the main entry point. Bun has no built-in arg parser like Node's `parseArgs`. Adding a dependency (e.g., `commander`, `yargs`) for a single boolean flag would violate the simplicity principle. A focused, hand-rolled approach is idiomatic for the codebase — the gateway and evals already parse `process.argv.slice(2)` directly.

**Alternatives considered**:
- `commander` / `yargs` — heavy dependency for one flag; violates YAGNI
- `util.parseArgs` (Node built-in) — available in Bun but limited; acceptable alternative if more flags added later
- Environment variable only — poor UX for CLI tool; doesn't match `--json` convention

## R2: Non-Interactive Agent Execution Path

**Decision**: Create a new `runJson()` function in a dedicated `src/json-runner.ts` module that directly uses `Agent.create()` and iterates the `agent.run()` async generator, bypassing all TUI code.

**Rationale**: The existing `AgentRunnerController` is tightly coupled to the TUI lifecycle (display events, working states, approval prompts, render callbacks). Creating a separate, minimal runner avoids:
1. Importing any `@mariozechner/pi-tui` code
2. Handling display events, working indicators, or render cycles
3. Complex conditional branching inside the existing TUI controller

The `Agent` class itself is clean and decoupled — it returns an `AsyncGenerator<AgentEvent>` that can be consumed by any runner. The JSON runner simply collects events and builds the response object.

**Alternatives considered**:
- Reuse `AgentRunnerController` with conditionals — increases complexity in existing, working code; violates single responsibility
- Create a shared base controller — premature abstraction for one alternative path; YAGNI

## R3: Tool Approval in Non-Interactive Mode

**Decision**: Auto-approve all tool calls in JSON mode by passing a `requestToolApproval` callback that always returns `'allow-once'`.

**Rationale**: In non-interactive mode there is no user to prompt. The spec explicitly states: "Tool approval prompts are automatically approved in JSON mode since there is no interactive user to approve them" (Assumption #5). Since Dexter's tool approval is for `write_file` and `edit_file` tools (filesystem modifications), and JSON mode is inherently for programmatic use where the caller has already opted in, auto-approval is the correct default.

**Alternatives considered**:
- Reject tool calls requiring approval — would break queries that need file tools; spec doesn't require this
- Add `--approve-tools` flag — YAGNI; auto-approve is the spec's stated assumption

## R4: JSON Response Schema

**Decision**: Define the JSON response schema using Zod (already a project dependency) with the following structure:

```typescript
{
  status: "success" | "error",
  query: string,
  answer: string,                    // Final answer text (empty string on error)
  tools: Array<{
    name: string,
    args: Record<string, unknown>,
    result: string
  }>,
  scratchpadFile: string,            // Relative path to .dexter/scratchpad/*.jsonl
  metadata: {
    model: string,
    iterations: number,
    totalTimeMs: number,
    tokenUsage?: {
      inputTokens: number,
      outputTokens: number,
      totalTokens: number
    }
  },
  error?: {                          // Present only when status === "error"
    code: string,                    // Machine-readable error code
    message: string                  // Human-readable description
  }
}
```

**Rationale**: This structure satisfies all FR-3 requirements (answer, query, status, tools, scratchpad reference). Zod validation ensures the output is always valid JSON conforming to the contract. The `metadata` block carries operational data without cluttering the top level. Error codes enable programmatic handling (FR-4).

**Alternatives considered**:
- Flat structure (no nesting) — harder to extend; mixes concerns
- Include raw scratchpad entries in response — bloated output; scratchpad file reference is sufficient
- JSON:API or HAL format — over-engineered for a CLI tool output

## R5: Scratchpad File Path Exposure

**Decision**: Add a public `getFilePath(): string` method to the `Scratchpad` class, and thread the scratchpad instance through the JSON runner to include the path in the response.

**Rationale**: The `Scratchpad.filepath` is currently private. FR-7 requires the scratchpad path in the JSON response. A simple getter is the minimal change. The `RunContext` already holds a reference to the scratchpad instance, so threading is straightforward.

**Alternatives considered**:
- Make `filepath` public — breaks encapsulation convention used elsewhere in the class
- Return path from `createRunContext()` — unnecessary split; the scratchpad owns its path

## R6: Stdin Query Reading

**Decision**: Read stdin using `Bun.stdin.text()` when no positional argument is provided and stdin is not a TTY.

**Rationale**: Bun provides `Bun.stdin` as a readable stream. `Bun.stdin.text()` reads until EOF and returns a Promise<string>, which is exactly what's needed for piped input. TTY detection via `process.stdin.isTTY` prevents hanging when no input is piped.

**Alternatives considered**:
- Always read stdin — would hang if no pipe; bad UX
- Require query as argument only — violates FR-2 which mandates stdin support
- Use readline interface — more complex than needed for read-all-then-execute

## R7: Exit Code Strategy

**Decision**: Use exit codes 0 (success) and 1 (all errors).

**Rationale**: The spec requires exit 0 for success and non-zero for errors. Using a single non-zero code (1) is the simplest approach that satisfies FR-6. Different error categories (user error vs system error) are distinguishable via the JSON `error.code` field rather than exit codes.

**Alternatives considered**:
- Multiple exit codes (1=user error, 2=system error, etc.) — YAGNI; the JSON body carries error detail
- Exit code 0 for all responses with error in JSON only — violates spec requirement for non-zero on error

## R8: Stderr Diagnostic Output

**Decision**: In JSON mode, redirect the existing `logger` utility to stderr. Suppress all TUI-related output (since no TUI is initialized). Progress events from the agent stream are optionally logged to stderr.

**Rationale**: FR-5 mandates stdout contains only the JSON object. The project already has a `logger` utility (`src/utils/logger.ts`). In JSON mode, any diagnostics (e.g., "Connecting to provider...", tool progress) go to stderr. Since the TUI is never initialized in JSON mode, there are no TUI artifacts to suppress.

**Alternatives considered**:
- Silent mode (no stderr output) — loses observability; users can redirect stderr if they don't want it
- Verbose flag for stderr — YAGNI; default stderr diagnostics are sufficient
