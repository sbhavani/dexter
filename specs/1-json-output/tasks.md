# Tasks: JSON Output Mode

**Feature Branch**: `1-json-output`
**Created**: 2026-02-22
**Spec**: [spec.md](./spec.md)
**Plan**: [plan.md](./plan.md)

---

## User Story Mapping

| Story | Description | Priority | Spec Section |
|-------|-------------|----------|--------------|
| US1 | Script Integration — run Dexter with `--json` and receive JSON output | P1 | Scenario 1 |
| US2 | Pipeline Consumption — clean stdout for `jq` piping | P1 | Scenario 2 |
| US3 | Error Handling — detect and handle failures programmatically | P1 | Scenario 3 |
| US4 | Query via CLI Argument — pass query as positional argument | P1 | Scenario 4 |

---

## Phase 1: Setup

**Goal**: Create project structure for JSON mode modules.

- [x] T001 Create `src/cli/` directory for JSON mode modules

---

## Phase 2: Foundational — Types, Schemas & Argument Parsing

**Goal**: Define the output contract and argument parser that all user stories depend on.
**Test criteria**: `parseArgs()` correctly parses all flag combinations; Zod schemas validate success and error output shapes.

- [x] T002 Add `JsonSuccessOutput`, `JsonErrorOutput`, `JsonOutput` types and Zod schemas (`JsonSuccessOutputSchema`, `JsonErrorOutputSchema`, `JsonOutputSchema`) to `src/agent/types.ts` per contract in `specs/1-json-output/contracts/json-output-schema.ts`. Include `TokenUsageSchema` and `ToolCallRecordSchema` reusing existing `TokenUsage` type. Export all schemas and types.
- [x] T003 [P] Write argument parser tests in `src/cli/parse-args.test.ts`. Test cases: no args → `{ json: false }`; `['--json']` → `{ json: true }`; `['--json', 'hello world']` → `{ json: true, query: 'hello world' }`; `['--json', '--model', 'claude-sonnet-4-20250514']` → `{ json: true, model: 'claude-sonnet-4-20250514' }`; multi-word query `['--json', 'What', 'is', 'PE?']` → query joined with spaces; `['--model']` without value → model undefined.
- [x] T004 Implement `parseArgs(argv: string[]): ParsedArgs` in `src/cli/parse-args.ts`. Parse `--json` boolean flag, `--model <value>` string flag, and remaining non-flag arguments joined as `query`. Export `parseArgs` and `ParsedArgs` interface. All tests from T003 must pass.

---

## Phase 3: Core JSON Mode [US1] [US4]

**Goal**: Implement the non-interactive JSON execution path — the core of the feature.
**Stories covered**: US1 (script integration), US4 (query via CLI argument).
**Test criteria**: `dexter --json "query"` outputs valid JSON matching `JsonSuccessOutput` schema; `echo "query" | dexter --json` reads from stdin; positional argument takes precedence over stdin.
**Dependencies**: Phase 2 must be complete.

- [x] T005 [US1] Write JSON mode unit tests in `src/cli/json-mode.test.ts`. Test cases: (1) `buildSuccessOutput()` with mock DoneEvent produces valid `JsonSuccessOutputSchema` output; (2) `buildErrorOutput()` produces valid `JsonErrorOutputSchema` output; (3) output is valid JSON via `JSON.parse()`; (4) `toolCalls` array serialized correctly from DoneEvent; (5) `tokenUsage` is omitted (not null) when absent in DoneEvent; (6) `model` field is included in output.
- [x] T006 [P] [US4] Implement `readStdinQuery(): Promise<string | undefined>` in `src/cli/json-mode.ts`. Check `process.stdin.isTTY` — if truthy, return `undefined` (no piped input). Otherwise, read all chunks from stdin until EOF, join, trim, and return. Return `undefined` if result is empty string.
- [x] T007 [US1] Implement `runJsonMode(query: string | undefined, options: { model?: string }): Promise<void>` in `src/cli/json-mode.ts`. Steps: (1) resolve query from argument or `readStdinQuery()`; (2) if no query, output JSON error and `process.exit(2)`; (3) resolve model via `options.model` → `process.env.DEXTER_MODEL` → `DEFAULT_MODEL`; (4) create `Agent.create({ model, modelProvider, maxIterations: 10, requestToolApproval: async () => 'allow-once' as ApprovalDecision })`; (5) iterate `agent.run(query)` collecting events; (6) on DoneEvent, build `JsonSuccessOutput` from its fields; (7) validate with `JsonSuccessOutputSchema`; (8) write `JSON.stringify(output, null, 2)` to stdout; (9) `process.exit(0)`. Wrap in try/catch: on error, output `JsonErrorOutput` and `process.exit(1)`.
- [x] T008 [US1] Update `src/index.tsx` to parse CLI args and branch execution. Import `parseArgs` from `src/cli/parse-args.ts` and `runJsonMode` from `src/cli/json-mode.ts`. Call `parseArgs(process.argv.slice(2))`. If `args.json` is true, call `await runJsonMode(args.query, { model: args.model })`. Otherwise, call existing `runCli()`. Ensure dotenv `config()` runs before argument parsing.

---

## Phase 4: stdout Isolation [US2]

**Goal**: Ensure stdout contains ONLY the JSON object — no contamination from libraries or diagnostics.
**Stories covered**: US2 (pipeline consumption).
**Test criteria**: `dexter --json "query" | jq '.'` succeeds without parse errors; no progress indicators, spinners, or debug output in stdout.
**Dependencies**: Phase 3 must be complete.

- [x] T009 [US2] Implement stdout isolation in `src/cli/json-mode.ts`. At the start of `runJsonMode()`, save reference to original `console.log` and override `console.log` to write to `process.stderr`. Also redirect `console.info` and `console.debug` to stderr. After agent execution completes and JSON output is ready, restore original `console.log` and use it for the single JSON output write. Ensure the restore happens in a `finally` block so it runs even on error.
- [x] T010 [P] [US2] Add stdout isolation test in `src/cli/json-mode.test.ts`. Verify that calling `console.log()` during agent execution (after isolation is active) does not write to stdout. Verify the final JSON output is the only thing written to stdout.

---

## Phase 5: Error Handling [US3]

**Goal**: All failure paths produce structured JSON error responses with correct exit codes.
**Stories covered**: US3 (error handling in automation).
**Test criteria**: Missing query returns `{ success: false, error: "..." }` with exit 2; agent errors return `{ success: false, error: "..." }` with exit 1; error output validates against `JsonErrorOutputSchema`.
**Dependencies**: Phase 3 must be complete.

- [x] T011 [US3] Add helper `buildSuccessOutput(query, doneEvent, model): JsonSuccessOutput` and `buildErrorOutput(query, error): JsonErrorOutput` as exported functions in `src/cli/json-mode.ts`. `buildSuccessOutput` maps DoneEvent fields (answer, toolCalls, iterations, totalTime→duration, tokenUsage) to the schema. `buildErrorOutput` creates `{ success: false, query, error: error.message || String(error) }`.
- [x] T012 [US3] Add error path tests in `src/cli/json-mode.test.ts`. Test cases: (1) `buildErrorOutput('query', new Error('API key missing'))` → validates against `JsonErrorOutputSchema`, has `success: false`; (2) `buildErrorOutput('', new Error('No query'))` → `query` is empty string; (3) `buildSuccessOutput` with all fields → validates against `JsonSuccessOutputSchema`.

---

## Phase 6: Polish & Cross-Cutting Concerns

**Goal**: Verify model resolution, ensure no regressions, validate end-to-end.
**Test criteria**: All existing tests pass; JSON mode works with real agent queries.

- [x] T013 Verify model resolution order in `src/cli/json-mode.ts`: `--model` flag → `DEXTER_MODEL` environment variable → `DEFAULT_MODEL` constant from `src/model/llm.ts`. Add a `resolveModel(flagModel?: string): { model: string; provider: string }` helper that implements this chain and determines the provider from the model name.
- [x] T014 Run full test suite with `bun test` to verify no regressions in existing TUI mode. All pre-existing tests must continue to pass. New tests in `src/cli/parse-args.test.ts` and `src/cli/json-mode.test.ts` must pass.
- [x] T015 Manual end-to-end verification: run `bun run src/index.tsx --json "What is 2+2?"` and confirm (1) output is valid JSON, (2) `success: true`, (3) no TUI rendering, (4) exit code 0. Run `bun run src/index.tsx --json` with no query and confirm (1) `success: false`, (2) exit code 2.

---

## Dependencies

### Task Dependency Graph

```
T001 ─────────────────────────────────────────────────> (all tasks depend on directory)
  │
  ├── T002 (types/schemas) ──┬── T005 (json-mode tests)
  │                          │     │
  │                          │     ├── T007 (runJsonMode handler) ──┬── T009 (stdout isolation)
  │                          │     │                                │     │
  │                          │     ├── T011 (build helpers)         │     └── T010 (isolation test)
  │                          │     │     │                          │
  │                          │     │     └── T012 (error tests)    ├── T013 (model resolution)
  │                          │     │                                │
  │                          │     └── T006 (stdin reader)          └── T008 (entry point)
  │                          │
  │                          └── T003 (parse-args tests) ── T004 (parseArgs impl)
  │
  └── T014 (full test suite) ── T015 (manual e2e)
```

### Story Completion Order

1. **US4** (Query via CLI Argument): Complete after T004 (argument parsing)
2. **US1** (Script Integration): Complete after T008 (entry point wired up)
3. **US2** (Pipeline Consumption): Complete after T009 (stdout isolation)
4. **US3** (Error Handling): Complete after T012 (error path tests pass)

All stories converge at T014 (full test suite verification).

---

## Parallel Execution Opportunities

### Phase 2 parallelism:
- T003 (parse-args tests) can run in parallel with T002 (types/schemas) — different files, no dependency

### Phase 3 parallelism:
- T006 (stdin reader) can run in parallel with T005 (json-mode tests) — independent functions

### Phase 4 parallelism:
- T010 (isolation test) can run in parallel with T011 (build helpers) — different concerns, same file but additive

---

## Implementation Strategy

### MVP Scope
**US1 (Script Integration)** is the MVP — Phases 1-3 (T001-T008) deliver a working `--json` flag that accepts a query and returns valid JSON.

### Incremental Delivery
1. **Increment 1** (Phases 1-3): Core JSON mode works end-to-end
2. **Increment 2** (Phase 4): stdout isolation makes it pipeline-safe
3. **Increment 3** (Phase 5): Error handling makes it production-ready
4. **Increment 4** (Phase 6): Polish and verification

### Test-First Approach (Constitution Principle I)
Within each phase, test tasks (T003, T005, T010, T012) are listed before their corresponding implementation tasks. Tests should be written first — implementations make the tests pass.
