# Tasks: JSON Output Flag

**Feature**: `--json` flag for structured output
**Branch**: `1-json-output-flag`
**Generated**: 2026-02-22
**Total Tasks**: 18
**Test Approach**: Test-first (Constitution Principle I: NON-NEGOTIABLE)

---

## Phase 1: Setup

> No project initialization needed — existing Bun + TypeScript project with all dependencies installed.

---

## Phase 2: Foundational

> Blocking prerequisites for all user stories. These create the schema contract and expose the scratchpad path needed by every response.

- [x] T001 Add `getFilePath(): string` public getter method to the `Scratchpad` class, returning `this.filepath`, in `src/agent/scratchpad.ts`
- [x] T002 Write tests for Zod schemas and response builder helpers (`buildSuccessResponse`, `buildErrorResponse`) covering success responses, error responses, required fields presence, and error field conditional presence in `src/__tests__/json-schema.test.ts`
- [x] T003 Create Zod schemas for `ToolRecordSchema`, `TokenUsageSchema`, `ResponseMetadataSchema`, `ErrorDetailSchema` (with error code enum: `NO_QUERY`, `AGENT_ERROR`, `PROVIDER_ERROR`, `CONFIG_ERROR`, `UNKNOWN_ERROR`), and `JsonResponseSchema` in `src/json-schema.ts` — matching the contract in `specs/1-json-output-flag/contracts/json-response.schema.json`
- [x] T004 Implement `buildSuccessResponse(query, doneEvent, scratchpadPath, model)` and `buildErrorResponse(query, errorCode, message, scratchpadPath?, model?)` helper functions in `src/json-schema.ts` — using the Zod schemas for validation and the `DoneEvent` type from `src/agent/types.ts`

**Phase 2 exit criteria**: All tests in `json-schema.test.ts` pass. `Scratchpad.getFilePath()` returns the JSONL file path.

---

## Phase 3: US1 — Script Integration (Primary Flow)

> **Story goal**: A user runs `bun start --json "query"` and receives a single valid JSON object on stdout with the answer, tools, and metadata.
>
> **Maps to**: FR-1 (JSON Flag Activation), FR-2 (Query Input — argument), FR-3 (JSON Response Structure)
>
> **Independent test criteria**: Run `bun start --json "What is 2+2?"` → stdout is parseable JSON with `status: "success"` and non-empty `answer`.

- [x] T005 [US1] Write tests for the core JSON runner: query via argument produces valid JSON response, response contains all required fields (status, query, answer, tools, scratchpadFile, metadata), tool auto-approval works, and `DoneEvent` data maps correctly to response — in `src/__tests__/json-runner.test.ts`
- [x] T006 [US1] Implement `runJson(args: string[])` in `src/json-runner.ts` — parse query from first non-flag positional argument, load model/provider from `loadConfig()`/`getSetting()`, create `Agent` with `requestToolApproval` callback returning `'allow-once'`, iterate `agent.run()` async generator to capture `DoneEvent`, build success response via `buildSuccessResponse()`, write `JSON.stringify(response)` to stdout, call `process.exit(0)`
- [x] T007 [US1] Modify `src/index.tsx` to parse `process.argv` for `--json` flag: if present, import and call `runJson()` with remaining args (filtering out `--json`); if absent, call `runCli()` as before — existing TUI behavior must remain unchanged

**Phase 3 exit criteria**: `bun start --json "test query"` outputs valid JSON to stdout with no TUI rendering. All `json-runner.test.ts` tests pass.

---

## Phase 4: US3 — Error Handling in Scripts

> **Story goal**: When a query fails in JSON mode, a structured JSON error is written to stdout and the process exits with code 1.
>
> **Maps to**: FR-4 (Error Responses), FR-6 (Exit Codes)
>
> **Independent test criteria**: Run `bun start --json` with no query → stdout is JSON with `status: "error"`, `error.code: "NO_QUERY"`, and exit code 1.

- [x] T008 [US3] Write tests for all error paths in `src/__tests__/json-runner.test.ts`: no query provided → `NO_QUERY` error + exit 1, agent execution throws → `AGENT_ERROR` error + exit 1, provider/auth failure → `PROVIDER_ERROR` error + exit 1, missing config → `CONFIG_ERROR` error + exit 1, unexpected error → `UNKNOWN_ERROR` error + exit 1 — all error responses must be valid JSON matching `JsonResponseSchema`
- [x] T009 [US3] Add error handling to `runJson()` in `src/json-runner.ts`: wrap agent execution in try/catch, classify errors into error codes (`NO_QUERY` for empty query, `PROVIDER_ERROR` for auth/connection errors, `AGENT_ERROR` for agent failures, `CONFIG_ERROR` for missing settings, `UNKNOWN_ERROR` catch-all), build error response via `buildErrorResponse()`, write to stdout, call `process.exit(1)`

**Phase 4 exit criteria**: Every error condition produces valid JSON on stdout with appropriate error code. Process exits with code 1 for all errors.

---

## Phase 5: US4 — Query via Stdin

> **Story goal**: A user pipes a query into Dexter via stdin (`echo "query" | bun start --json`) and receives JSON output.
>
> **Maps to**: FR-2 (Query Input — stdin)
>
> **Independent test criteria**: `echo "test query" | bun start --json` → stdout is JSON with `status: "success"`.

- [x] T010 [US4] Write tests for stdin query reading in `src/__tests__/json-runner.test.ts`: query via stdin produces valid JSON, TTY detection prevents hanging when no stdin pipe, stdin EOF reading works correctly, empty stdin produces `NO_QUERY` error
- [x] T011 [US4] Add stdin reading to `runJson()` in `src/json-runner.ts`: when no positional argument is provided, check `process.stdin.isTTY` — if false (piped), read query via `Bun.stdin.text()`, trim whitespace, validate non-empty; if true (TTY, no pipe), output `NO_QUERY` error response and exit 1

**Phase 5 exit criteria**: `echo "What is Apple's revenue?" | bun start --json` produces valid JSON response. `bun start --json` with no pipe outputs `NO_QUERY` error.

---

## Phase 6: US2 + US5 — Pipeline Composition & Scratchpad Observability

> **Story goal**: stdout contains only valid JSON (no TUI artifacts, progress indicators, or logs). Scratchpad JSONL file is created with full detail, and its path is in the response.
>
> **Maps to**: FR-3 (clean output), FR-5 (Stderr for Diagnostics), FR-7 (Scratchpad Compatibility)
>
> **Independent test criteria**: `bun start --json "query" 2>/dev/null | jq .` succeeds. Scratchpad file exists at path in response.

- [x] T012 [P] [US2] Write tests for stdout cleanliness in `src/__tests__/json-runner.test.ts`: stdout output parses as valid JSON with no leading/trailing non-JSON bytes, stderr redirection to `/dev/null` still produces valid JSON on stdout, no TUI component imports in `src/json-runner.ts`
- [x] T013 [P] [US5] Write tests for scratchpad in JSON mode in `src/__tests__/json-runner.test.ts`: scratchpad JSONL file is created at the path specified in `response.scratchpadFile`, scratchpad contains `init` entry matching the query, scratchpad format matches interactive mode (same entry types)
- [x] T014 [US2] Ensure all diagnostic/progress output in `runJson()` uses `console.error()` (stderr) instead of `console.log()` (stdout) in `src/json-runner.ts` — verify no imported module writes to stdout during agent execution

**Phase 6 exit criteria**: `bun start --json "query" 2>/dev/null` outputs only JSON. Scratchpad file exists and contains expected JSONL entries.

---

## Phase 7: Polish & Cross-Cutting Concerns

> End-to-end validation, export hygiene, and documentation.

- [x] T015 Export `JsonResponseSchema` type and builder functions from `src/json-schema.ts` for potential external consumers
- [x] T016 Write end-to-end integration test in `src/__tests__/json-runner.test.ts` that validates the full flow: argument parsing → agent execution → JSON output → exit code — using a mock agent to avoid real LLM calls
- [x] T017 [P] Verify existing TUI mode is unaffected: `bun start` (without `--json`) still launches interactive TUI — add regression guard in `src/__tests__/json-runner.test.ts`
- [x] T018 [P] Run full test suite (`bun test`) to ensure no regressions in existing tests

**Phase 7 exit criteria**: All tests pass. TUI mode works as before. `bun test` is green.

---

## Dependencies

```
Phase 2 (Foundational)
  │
  ▼
Phase 3 (US1: Script Integration) ← MVP
  │
  ├──────────┬──────────┐
  ▼          ▼          ▼
Phase 4    Phase 5    Phase 6
(US3)      (US4)      (US2+US5)
  │          │          │
  └──────────┴──────────┘
             │
             ▼
        Phase 7 (Polish)
```

**Parallel opportunities**:
- Phase 4 (US3), Phase 5 (US4), Phase 6 (US2+US5) are independent after Phase 3
- Within Phase 2: T002 + T003 can start in parallel (test file + schema file)
- Within Phase 6: T012 + T013 can run in parallel (different test concerns)
- Within Phase 7: T017 + T018 can run in parallel

## Implementation Strategy

### MVP Scope (Phases 2-3)
Deliver the core `--json` flag with argument-based queries. This alone satisfies Scenario 1 and enables basic script integration. **6 tasks, ~60% of user value.**

### Incremental Delivery
1. **MVP** (Phases 2-3): `bun start --json "query"` works end-to-end
2. **Error resilience** (Phase 4): All error paths produce valid JSON
3. **Stdin support** (Phase 5): Pipeline input via stdin
4. **Production hardening** (Phase 6): Clean stdout, scratchpad verification
5. **Validation** (Phase 7): Regression guards, full suite green

### Task Count by Story

| Story | Tasks | Description |
| ----- | ----- | ----------- |
| Foundational | 4 | Schema, builders, scratchpad getter |
| US1 (Script Integration) | 3 | Core runner, entry point, tests |
| US3 (Error Handling) | 2 | Error paths, exit codes |
| US4 (Stdin Query) | 2 | Stdin reading, TTY detection |
| US2+US5 (Pipeline + Scratchpad) | 3 | Stdout cleanliness, scratchpad verification |
| Polish | 4 | Integration, regression, exports |
| **Total** | **18** | |
