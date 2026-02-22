# Research: JSON Output Mode

**Created**: 2026-02-22
**Feature Branch**: `1-json-output`

---

## R1: CLI Argument Parsing Strategy

**Decision**: Use raw `process.argv` parsing in a utility module — no new dependency.

**Rationale**: The Dexter codebase has no CLI argument parsing framework. The constitution (Principle V: Simplicity/YAGNI) discourages adding dependencies for simple tasks. Only two flags are needed for JSON mode (`--json`, `--model <name>`), which is trivially handled with `process.argv.slice(2)` parsing. The evals module (`src/evals/run.ts`) already uses this pattern for `--sample`.

**Alternatives considered**:
- `commander` / `yargs`: Full-featured CLI frameworks. Overkill for 2 flags; adds dependency.
- `minimist`: Lightweight parser. Still an unnecessary dependency for this scope.
- `zod` for arg validation: Already a dependency but designed for data validation, not argv parsing. Could be used later if args grow complex.

---

## R2: Buffered vs. Streaming JSON Output

**Decision**: Buffered — output a single complete JSON object after agent finishes.

**Rationale**: The spec explicitly requires "a single, complete JSON object (not streamed fragments)" for compatibility with `jq` and standard JSON parsers. Buffered output is atomic (no partial output on failure) and simpler to implement. Streaming NDJSON is explicitly out of scope per the spec.

**Alternatives considered**:
- NDJSON streaming: Each `AgentEvent` written as a separate JSON line. Useful for real-time processing of long-running queries. Listed as future enhancement in spec's Out of Scope section.
- Server-Sent Events (SSE): HTTP-based streaming. Not applicable for CLI.

---

## R3: Tool Approval in Non-Interactive Mode

**Decision**: Auto-approve all tools when `--json` flag is active.

**Rationale**: The spec states "No user prompts for tool approval — tools requiring approval are auto-approved in JSON mode." The current approval mechanism uses a Promise-based callback (`requestToolApproval`) in `AgentToolExecutor`. In JSON mode, this callback simply returns `'allow-once'` immediately. Only `write_file` and `edit_file` require approval — auto-approving is safe since the user explicitly opts into non-interactive mode.

**Alternatives considered**:
- `--approve-all` flag: Requires explicit opt-in for auto-approval. Adds friction without benefit since `--json` itself is the opt-in.
- Deny tools requiring approval: Would break queries that need file operations. Too restrictive.
- stdin-based approval: Read Y/N from stdin for each approval. Breaks piped input and complicates the flow.

---

## R4: Model Selection Without Interactive Prompts

**Decision**: Resolution order: `--model` flag → `DEXTER_MODEL` env var → saved config → `DEFAULT_MODEL` (`gpt-5.2`).

**Rationale**: JSON mode cannot display interactive model selection. The existing `ModelSelectionController` persists the user's last selection to config. This saved config is a reasonable default. The `--model` flag provides explicit override for scripting. Environment variable support enables CI/CD configuration.

**Alternatives considered**:
- Require `--model` flag in JSON mode: Too strict; forces users to specify model every time.
- Use only `DEFAULT_MODEL`: Ignores user's saved preference; poor UX.

---

## R5: stdout Isolation

**Decision**: Intercept and redirect all non-JSON output to stderr in JSON mode.

**Rationale**: NFR-1 requires stdout to contain only valid JSON. LangChain, dotenv, and other libraries may log to console. In JSON mode, `console.log` must be reserved exclusively for the final JSON output. All other console methods (`console.warn`, `console.error`, `console.info`) should write to stderr. If necessary, temporarily override `console.log` to write to stderr during agent execution, then restore for the final JSON output.

**Alternatives considered**:
- Suppress all console output: Loses diagnostic information; harder to debug.
- Add `--quiet` flag: Separate concern; doesn't guarantee stdout cleanliness.
- Use a logger: The existing logger (`src/utils/logger.ts`) is in-memory and TUI-focused. Could be extended but adds complexity.

---

## R6: Exit Code Strategy

**Decision**: Use three exit codes aligned with Unix conventions.

**Rationale**: The spec defines: 0 (success), 1 (runtime error), 2 (invalid usage). This follows POSIX conventions and matches tools like `curl`, `grep`, and `jq`. Exit code 2 for usage errors is a common CLI pattern.

**Alternatives considered**:
- More granular codes (e.g., 3 for timeout, 4 for auth failure): Over-engineering for v1. The JSON `error` field provides details.
- Only 0/1: Loses the distinction between "query failed" and "invalid usage".

---

## R7: Stdin Reading Behavior

**Decision**: Read stdin only when `process.stdin.isTTY` is `false` (piped input detected). Read until EOF.

**Rationale**: When input is piped (`echo "query" | dexter --json`), `process.stdin.isTTY` returns `false` or `undefined`. Reading until EOF handles multi-line queries and is the standard pattern for Unix CLI tools. When running in a TTY without piped input, stdin is not read (query must come from argument).

**Alternatives considered**:
- Always read stdin with timeout: Complex; could hang if no input provided.
- Require `--stdin` flag for piped input: Unnecessary friction; standard tools detect piping automatically.
