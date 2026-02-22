# Feature Specification: JSON Output Mode

**Version**: 1.0.0
**Status**: Draft
**Created**: 2026-02-22
**Feature Branch**: `1-json-output`

## Overview

Dexter currently operates exclusively as an interactive terminal application with a text-based user interface (TUI). This limits its use to manual, human-driven workflows. Adding a `--json` flag enables Dexter to output structured JSON responses to stdout, making it usable in scripts, pipelines, CI/CD workflows, and programmatic integrations where machine-readable output is required.

## Problem Statement

Users who want to integrate Dexter into automated workflows — such as shell scripts, data pipelines, or CI jobs — cannot currently do so because:

1. All output is rendered through an interactive TUI that requires a terminal
2. There is no way to capture structured results from the command line
3. No non-interactive execution mode exists for batch or single-query operation

This prevents adoption in automation scenarios and limits Dexter to manual use only.

## User Scenarios & Testing

### Scenario 1: Script Integration

**As a** developer automating financial analysis,
**I want to** run Dexter with a query and receive JSON output,
**So that** I can parse the result in my script and feed it into downstream processes.

**Example**:
```
echo "What is Apple's current P/E ratio?" | dexter --json
```

**Expected behavior**: Dexter processes the query non-interactively, outputs a single JSON object to stdout, and exits with an appropriate exit code.

**Acceptance criteria**:
- Output is valid, parseable JSON written to stdout
- No TUI rendering or interactive prompts appear
- Process exits with code 0 on success, non-zero on failure
- Errors are written to stderr, not mixed into JSON stdout

### Scenario 2: Pipeline Consumption

**As a** data engineer building a pipeline,
**I want to** pipe Dexter's JSON output into tools like `jq`, `python`, or database loaders,
**So that** I can extract specific fields and transform the data programmatically.

**Example**:
```
echo "Get Tesla's revenue for the last 3 years" | dexter --json | jq '.answer'
```

**Acceptance criteria**:
- Output is a single, complete JSON object (not streamed fragments)
- JSON structure is consistent and documented
- Output contains the answer text, tool call details, and metadata
- No extraneous output (progress indicators, spinners, debug info) contaminates stdout

### Scenario 3: Error Handling in Automation

**As a** DevOps engineer running Dexter in a CI job,
**I want to** detect and handle failures programmatically,
**So that** my pipeline can respond appropriately to errors.

**Acceptance criteria**:
- Failed queries produce a JSON error object on stdout with a `success: false` field
- Error messages are included in the JSON output
- Exit code is non-zero on failure
- Timeout scenarios produce a clear error response rather than hanging

### Scenario 4: Query via Command-Line Argument

**As a** user running a one-off query from the terminal,
**I want to** pass my query as a command-line argument alongside `--json`,
**So that** I don't need to use stdin piping for simple queries.

**Example**:
```
dexter --json "What is Apple's market cap?"
```

**Acceptance criteria**:
- Query can be provided as a positional argument after `--json`
- Query can also be provided via stdin (piped input)
- If both are provided, the positional argument takes precedence
- If no query is provided, an error JSON object is returned

## Functional Requirements

### FR-1: JSON Output Flag

The application must accept a `--json` flag that switches output mode from interactive TUI to structured JSON on stdout.

- The flag must be recognized at application startup before any processing begins
- When active, no interactive TUI elements are rendered
- All diagnostic, progress, and debug output is suppressed from stdout (may go to stderr)

### FR-2: Non-Interactive Execution

When `--json` is active, the application must operate in a fully non-interactive mode.

- The application reads a single query (from argument or stdin), processes it, outputs JSON, and exits
- No user prompts for tool approval — tools requiring approval are auto-approved in JSON mode
- No model selection prompts — uses the configured default model
- No multi-turn conversation — single query in, single response out

### FR-3: Structured JSON Output Schema

The JSON output must follow a consistent, documented schema.

**Success response**:
- `success` (boolean): Always `true` for successful queries
- `query` (string): The original user query
- `answer` (string): The agent's final answer text
- `toolCalls` (array): List of tools invoked, each with tool name, arguments, and result
- `iterations` (number): Number of agent loop iterations
- `duration` (number): Total processing time in milliseconds
- `tokenUsage` (object, optional): Token consumption breakdown (input, output, total)
- `model` (string): The model used to process the query

**Error response**:
- `success` (boolean): Always `false` for failed queries
- `query` (string): The original user query (if available)
- `error` (string): Human-readable error description

### FR-4: Query Input Methods

The application must support receiving queries through multiple input channels when in JSON mode.

- Positional command-line argument: `dexter --json "query text"`
- Standard input (piped): `echo "query text" | dexter --json`
- If no query is provided through either method, return a JSON error

### FR-5: Exit Codes

The application must return meaningful exit codes for programmatic consumption.

- Exit code 0: Query processed successfully
- Exit code 1: Query processing failed (runtime error, model error)
- Exit code 2: Invalid usage (no query provided, invalid flags)

### FR-6: Stderr for Diagnostics

When in JSON mode, any non-JSON diagnostic output (warnings, progress, debug information) must be written to stderr, never stdout.

- Stdout must contain only the final JSON object
- Stderr may contain progress or diagnostic information if needed

## Non-Functional Requirements

### NFR-1: Output Validity

The JSON output must be valid JSON that can be parsed by any standard JSON parser. Malformed output is considered a bug.

### NFR-2: Predictable Schema

The JSON output schema must remain stable across minor versions. Fields may be added but existing fields must not be removed or change type without a major version bump.

### NFR-3: Reasonable Response Time

JSON mode should have equivalent or better performance compared to interactive mode, since it does not need to render TUI elements.

## Scope

### In Scope

- `--json` flag for single-query, non-interactive JSON output
- Consistent JSON output schema for success and error cases
- stdin and argument-based query input
- Meaningful exit codes
- Clean stdout/stderr separation

### Out of Scope

- Streaming JSON output (newline-delimited JSON events) — future enhancement
- CSV or other structured output formats — separate feature
- Multi-query batch mode — separate feature
- JSON output for the interactive TUI mode (e.g., logging alongside TUI)
- Custom JSON schema selection or field filtering

## Dependencies

- Existing agent event and result data is available to construct JSON output
- Scratchpad logging continues to function independently of output mode

## Assumptions

- The default model is pre-configured and does not require interactive selection in JSON mode
- Tool approval is auto-granted in JSON mode since there is no interactive user to approve
- A single query produces a single JSON response (no streaming or partial results)
- The JSON output includes the complete answer and tool call history from the agent's final result
- Exit codes follow Unix conventions (0 = success, non-zero = failure)
- Stdin input reads until EOF (supports piped input naturally)

## Success Criteria

1. Users can run Dexter with `--json` and a query to receive a valid JSON response on stdout
2. The JSON output is parseable by standard tools (`jq`, Python `json.loads()`, Node.js `JSON.parse()`)
3. Scripts can reliably determine success or failure via both the JSON `success` field and the process exit code
4. No interactive prompts or TUI rendering occurs when `--json` is active
5. Stdout contains only the JSON object — no contamination from progress indicators, debug output, or other text
6. Error scenarios produce structured JSON error responses rather than unstructured error text
7. Pipeline integration works end-to-end: query in via stdin/argument, structured data out via stdout
