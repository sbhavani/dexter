# Feature Specification: JSON Output Flag

**Feature**: `--json` flag for structured output
**Branch**: `1-json-output-flag`
**Status**: Draft
**Created**: 2026-02-22

## Problem Statement

Dexter currently operates exclusively through an interactive terminal UI (TUI), producing human-readable natural language responses. There is no way to use Dexter programmatically from scripts, CI/CD pipelines, or other automated workflows. Developers and power users who want to integrate Dexter's financial research capabilities into larger systems must manually parse unstructured text output, which is fragile, error-prone, and impractical at scale.

## Feature Description

Add a `--json` flag that runs Dexter in non-interactive mode, accepting a query and returning the complete research response as structured JSON written to stdout. This enables programmatic consumption of Dexter's financial research capabilities in scripts, pipelines, and integrations without requiring manual parsing of natural language output.

When the `--json` flag is provided, Dexter bypasses the interactive TUI, executes the query autonomously, and outputs a well-defined JSON object containing the answer, metadata, and tool execution details.

## User Scenarios & Testing

### Scenario 1: Script Integration (Primary Flow)

**Given** a user runs Dexter with `--json` and a query from the command line
**When** the agent completes its research
**Then** a single JSON object is written to stdout containing the answer and metadata, with no TUI rendering or interactive prompts

### Scenario 2: Pipeline Composition

**Given** a user pipes Dexter's JSON output into another program (e.g., `jq`, a data pipeline, or a downstream service)
**When** the output is received
**Then** the output is valid, parseable JSON on a single logical stream (stdout) with no interleaved TUI artifacts, progress indicators, or human-readable decorations

### Scenario 3: Error Handling in Scripts

**Given** a user runs Dexter with `--json` and the query fails (invalid query, API error, timeout, etc.)
**When** the error occurs
**Then** a JSON object describing the error is written to stdout with an appropriate error structure, and the process exits with a non-zero exit code

### Scenario 4: Query via Stdin

**Given** a user pipes a query into Dexter via stdin while using the `--json` flag
**When** Dexter reads the piped input
**Then** it treats the piped content as the query and returns JSON output, enabling use in pipelines where the query itself is dynamically generated

### Scenario 5: Scratchpad Observability Preserved

**Given** a user runs Dexter with `--json`
**When** the agent executes tools and produces reasoning steps
**Then** the scratchpad JSONL file is still created in `.dexter/scratchpad/` as it would be in interactive mode, preserving full debugging capability

## Functional Requirements

### FR-1: JSON Flag Activation (Mandatory)

Dexter must accept a `--json` flag that switches output from interactive TUI mode to structured JSON mode. When this flag is present, no TUI is rendered and no interactive input is accepted.

**Acceptance Criteria**:
- Running Dexter with `--json` and a query produces JSON on stdout
- Running Dexter with `--json` and no query reads from stdin
- The `--json` flag can be combined with other future flags without conflict

### FR-2: Query Input (Mandatory)

In JSON mode, the user's research query must be accepted via one of:
1. A positional argument on the command line (e.g., `bun start --json "What is Apple's revenue?"`)
2. Standard input (stdin), when no positional argument is provided

**Acceptance Criteria**:
- Query provided as argument: executes immediately
- Query provided via stdin: reads until EOF, then executes
- No query provided (neither argument nor stdin): outputs a JSON error and exits with non-zero code

### FR-3: JSON Response Structure (Mandatory)

The JSON output must be a single, well-formed JSON object written to stdout. It must include:
- The final answer text
- The original query
- A status indicator (success or error)
- A list of tools that were invoked during research
- A reference to the scratchpad file for debugging

**Acceptance Criteria**:
- Output is valid JSON (parseable by any standard JSON parser)
- Output is a single JSON object (not JSONL, not an array)
- All required fields are present in both success and error cases
- No non-JSON content appears on stdout (progress, logs, TUI artifacts go to stderr or are suppressed)

### FR-4: Error Responses (Mandatory)

When an error occurs in JSON mode, Dexter must output a JSON object to stdout containing the error details and exit with a non-zero exit code.

**Acceptance Criteria**:
- Error output is valid JSON with a clear error status
- Error messages are descriptive enough for programmatic handling
- Process exits with non-zero code on any error
- Both user errors (bad query) and system errors (API failure) produce structured JSON

### FR-5: Stderr for Diagnostics (Mandatory)

In JSON mode, any progress information, warnings, or diagnostic messages must be written to stderr, keeping stdout clean for JSON-only output.

**Acceptance Criteria**:
- stdout contains only the final JSON object
- stderr may contain progress or diagnostic information
- Redirecting stderr to `/dev/null` still produces valid JSON on stdout

### FR-6: Exit Codes (Mandatory)

Dexter must use meaningful exit codes in JSON mode to enable script-level error handling.

**Acceptance Criteria**:
- Exit code 0: successful research completion
- Non-zero exit code: any error condition
- Exit codes are consistent and documented

### FR-7: Scratchpad Compatibility (Mandatory)

JSON mode must not bypass the scratchpad system. All tool calls, reasoning steps, and results must be logged to the scratchpad JSONL file exactly as they are in interactive mode.

**Acceptance Criteria**:
- A scratchpad file is created for every JSON-mode query
- Scratchpad entries match the same format as interactive mode
- The scratchpad file path is included in the JSON response

## Scope & Boundaries

### In Scope

- `--json` flag for non-interactive, single-query execution
- Structured JSON output to stdout
- Query input via command-line argument or stdin
- Error responses as JSON
- Clean separation of JSON output (stdout) vs diagnostics (stderr)
- Scratchpad logging in JSON mode

### Out of Scope

- Streaming JSON output (token-by-token) — separate future feature
- CSV or other structured formats — may be added later as separate flags
- Interactive JSON mode (read queries in a loop) — not part of this feature
- Changes to the existing TUI behavior — TUI remains the default
- JSON output for the WhatsApp gateway — gateway has its own protocol
- Model selection via flags — may be added in a future feature

## Dependencies

- Existing agent execution pipeline (task planning, tool execution, answer generation)
- Scratchpad system for observability logging
- LLM provider configuration (environment variables)

## Assumptions

- The default mode (no `--json` flag) remains the interactive TUI — no behavioral changes to existing users
- A single query per invocation is sufficient for the initial implementation; batch/loop modes are future work
- The JSON response includes the full final answer, not intermediate reasoning steps (those remain in the scratchpad)
- Model/provider selection continues to use environment variables and `.dexter/settings.json` — no need for a `--model` flag in this feature
- Tool approval prompts are automatically approved in JSON mode since there is no interactive user to approve them

## Success Criteria

1. **Programmatic usability**: Dexter's output in JSON mode can be parsed by standard tools (e.g., `jq`) without error in 100% of cases
2. **Script reliability**: A 10-query automated script using `--json` mode completes without manual intervention
3. **Behavioral parity**: The quality and accuracy of answers in JSON mode is identical to interactive mode for the same queries
4. **Clean output**: Zero non-JSON bytes appear on stdout when `--json` is used
5. **Error recoverability**: Scripts can programmatically detect and handle all error conditions via exit codes and JSON error structure
6. **Observability maintained**: Every JSON-mode query produces a complete scratchpad file, matching the detail level of interactive mode queries

## Key Entities

| Entity          | Description                                                       |
| --------------- | ----------------------------------------------------------------- |
| Query           | The user's financial research question (string)                   |
| JSON Response   | Structured output containing answer, metadata, and tool details   |
| Error Response  | Structured output for error conditions with status and message    |
| Scratchpad File | JSONL log of tool calls and reasoning (same as interactive mode)  |
| Exit Code       | Process exit code indicating success (0) or failure (non-zero)    |
