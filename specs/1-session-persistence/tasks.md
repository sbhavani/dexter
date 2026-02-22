# Tasks: Session Persistence

**Feature**: 1-session-persistence
**Branch**: `1-session-persistence`
**Generated**: 2026-02-22
**Total Tasks**: 28

## User Story Mapping

| Story | Spec Requirement | Summary | Priority |
|-------|-----------------|---------|----------|
| US1 | FR-1, FR-2, FR-5 | Automatic session creation, history persistence, metadata tracking | P1 |
| US2 | FR-3, FR-6 | Session resumption via `--session <id>` with context reconstruction | P1 |
| US3 | FR-4 | Session listing with metadata | P2 |
| US4 | FR-7 | Session deletion | P2 |

---

## Phase 1: Setup

- [x] T001 Create `src/sessions/` directory and module barrel export in `src/sessions/index.ts`
- [x] T002 Create type definitions and Zod schemas for `SessionMetadata`, `SessionExchange`, `SessionIndex`, and `TokenUsageRecord` in `src/sessions/types.ts` — use field definitions from `specs/1-session-persistence/data-model.md` (SessionIndex version field starts at 1; SessionMetadata fields: id, createdAt, updatedAt, exchangeCount, model, provider, firstQuery, lastQuery; SessionExchange fields: id, timestamp, query, answer, summary, model, status, duration, tokenUsage)

---

## Phase 2: Foundational

- [x] T003 [P] Create session ID generator using Bun crypto (`crypto.getRandomValues`) producing 8-char lowercase alphanumeric strings in `src/sessions/id.ts` — see research.md R1
- [x] T004 [P] Create `SessionStore` class in `src/sessions/session-store.ts` — manages `.dexter/sessions/index.json` with methods: `load()`, `save()`, `create(metadata)`, `get(id)`, `list()`, `update(id, partial)`, `delete(id)` — follow the pattern in `src/gateway/sessions/store.ts` and `src/utils/long-term-chat-history.ts` for file I/O (use `mkdirSync`/`writeFileSync` or async equivalents, handle missing directories)
- [x] T005 [P] Create `SessionHistory` class in `src/sessions/session-history.ts` — manages `.dexter/sessions/cli/{id}/history.jsonl` with methods: `append(exchange: SessionExchange)` (one JSON line per call), `load(): SessionExchange[]` (resilient line-by-line parsing that skips malformed lines — follow `src/agent/scratchpad.ts` pattern for JSONL resilience) — see research.md R2, R3
- [x] T006 [P] Write tests for session ID generator in `src/sessions/id.test.ts` — verify: 8-char length, lowercase alphanumeric only, uniqueness across 1000 generated IDs — use `bun:test` with `describe`/`test`/`expect` pattern (see `src/gateway/sessions/store.test.ts` for style reference)
- [x] T007 Write tests for `SessionStore` in `src/sessions/session-store.test.ts` — test: create session, get by ID, list returns all, update metadata, delete removes from index, get non-existent returns null, load creates file if missing — use `mkdtempSync`/`rmSync` for temp directories (see `src/gateway/sessions/store.test.ts` pattern)
- [x] T008 [P] Write tests for `SessionHistory` in `src/sessions/session-history.test.ts` — test: append writes JSONL line, load reads all exchanges, load skips malformed lines gracefully, append creates directory if missing, empty file returns empty array — use temp directories

---

## Phase 3: US1 — Automatic Session Creation & Persistence

**Story goal**: When a user starts Dexter, a new session is automatically created with a displayed ID, and all exchanges are persisted incrementally to disk.

**Independent test criteria**: Start Dexter without flags → session ID appears in banner → submit a query → verify `.dexter/sessions/index.json` contains session metadata and `.dexter/sessions/cli/{id}/history.jsonl` contains the exchange.

- [x] T009 [US1] Create `SessionManager` class in `src/sessions/session-manager.ts` with methods: `startNew(model: string, provider: string): SessionMetadata` (generates ID via `id.ts`, creates metadata in `SessionStore`, initializes empty `SessionHistory`) and `saveExchange(exchange: { query, answer, summary, model, status, duration, tokenUsage })` (appends to `SessionHistory`, updates `SessionStore` metadata with new `updatedAt`, `exchangeCount`, `lastQuery`) — this is the core orchestrator connecting `SessionStore` + `SessionHistory`
- [x] T010 [US1] Write tests for `SessionManager.startNew()` and `saveExchange()` in `src/sessions/session-manager.test.ts` — test: startNew creates index entry and history directory, saveExchange appends to JSONL and updates metadata, multiple exchanges increment count
- [x] T011 [US1] Add CLI argument parsing to `src/index.tsx` — parse `process.argv.slice(2)` for `--session <id>`, `--list-sessions`, `--delete-session <id>`, and `--json` flags; pass parsed options as an argument to `runCli(options)` — use simple hand-rolled parsing (research.md R4), follow gateway pattern in `src/gateway/index.ts`
- [x] T012 [US1] Update `runCli()` signature in `src/cli.ts` to accept optional `SessionOptions` parameter (`{ sessionId?: string, listSessions?: boolean, deleteSession?: string, json?: boolean }`) and create `SessionManager` instance at startup — call `sessionManager.startNew(model, provider)` when no session flags provided
- [x] T013 [US1] Display session ID in TUI intro banner — update `IntroComponent` in `src/components/` to accept and display session ID (e.g., "Session: a7k3m9x2") — see `contracts/cli-interface.md` for exact format
- [x] T014 [US1] Hook exchange persistence into query completion flow in `src/cli.ts` — after `agentRunner.runQuery()` completes in `handleSubmit()`, call `sessionManager.saveExchange()` with the query, answer, model, status, duration, and token usage from the completed `HistoryItem` — also pass the summary from `InMemoryChatHistory` (last message's summary field)

---

## Phase 4: US2 — Session Resumption

**Story goal**: Users can resume a previous session via `--session <id>`, seeing prior conversation and continuing with full agent context awareness.

**Independent test criteria**: Create a session with 3 exchanges → exit → run `dexter --session <id>` → prior exchanges display → new query references prior context successfully.

- [x] T015 [US2] Implement `SessionManager.resume(id: string, inMemoryChatHistory: InMemoryChatHistory): { metadata: SessionMetadata, exchanges: SessionExchange[] }` in `src/sessions/session-manager.ts` — load metadata from store, load exchanges from history JSONL, replay each exchange into `InMemoryChatHistory` by calling `saveUserQuery(query)` then setting `answer` and `summary` directly on the message for completed exchanges — see research.md R5
- [x] T016 [US2] Write tests for `SessionManager.resume()` in `src/sessions/session-manager.test.ts` — test: resume loads exchanges, resume replays into InMemoryChatHistory (mock or verify messages array), resume with non-existent ID throws/returns error, resumed session continues saving new exchanges
- [x] T017 [US2] Wire `--session <id>` flag in `src/cli.ts` — when `sessionOptions.sessionId` is provided, call `sessionManager.resume(id, inMemoryChatHistory)` instead of `startNew()`, update intro banner to show "(resumed, N exchanges)" — see `contracts/cli-interface.md` for format
- [x] T018 [US2] Display prior exchanges on resume — after `sessionManager.resume()` returns exchanges, convert them to `HistoryItem[]` format (with id, query, answer, status='complete') and set them on `agentRunner` (add a `setHistory(items: HistoryItem[])` method to `AgentRunnerController` in `src/controllers/agent-runner.ts`), then call `renderHistory()` to display them in the TUI chat log
- [x] T019 [US2] Handle session-not-found error in `src/index.tsx` or `src/cli.ts` — when `--session <id>` references a non-existent session, print error to stderr with the invalid ID and list up to 5 most recent available sessions with their IDs and first query preview, then exit with code 1 — see `contracts/cli-interface.md` error format

---

## Phase 5: US3 — Session Listing

**Story goal**: Users can view all saved sessions with enough metadata to identify and resume the one they want.

**Independent test criteria**: Create 3 sessions with different queries → run `dexter --list-sessions` → see all 3 listed with IDs, dates, exchange counts, and query previews in reverse chronological order.

- [x] T020 [P] [US3] Implement `SessionManager.listSessions(): SessionMetadata[]` in `src/sessions/session-manager.ts` — delegate to `SessionStore.list()`, sort by `updatedAt` descending (most recent first)
- [x] T021 [P] [US3] Write tests for `SessionManager.listSessions()` in `src/sessions/session-manager.test.ts` — test: returns empty array when no sessions, returns all sessions sorted by updatedAt desc, list reflects creates and deletes
- [x] T022 [US3] Implement `--list-sessions` handler in `src/index.tsx` — when flag is set, create `SessionManager`, call `listSessions()`, format as human-readable table (columns: ID, Created, Last Active, Exchanges, Preview — see `contracts/cli-interface.md` for exact format), print to stdout, exit with code 0; if no sessions, print "No saved sessions found."
- [x] T023 [P] [US3] Add `--json` flag support for `--list-sessions` in `src/index.tsx` — when both `--list-sessions` and `--json` are set, output `{ sessions: [...], count: N }` JSON to stdout instead of the table — see `contracts/cli-interface.md` JSON format

---

## Phase 6: US4 — Session Deletion

**Story goal**: Users can delete sessions they no longer need, with confirmation to prevent accidents.

**Independent test criteria**: Create a session → run `dexter --delete-session <id>` → confirm → verify session removed from index.json and history directory deleted → verify it no longer appears in `--list-sessions`.

- [x] T024 [P] [US4] Implement `SessionManager.deleteSession(id: string): boolean` in `src/sessions/session-manager.ts` — delete from `SessionStore` (remove from index), delete the session's history directory (`.dexter/sessions/cli/{id}/`), return true on success, throw/return false if session not found
- [x] T025 [P] [US4] Write tests for `SessionManager.deleteSession()` in `src/sessions/session-manager.test.ts` — test: delete removes from index, delete removes history directory, delete non-existent returns false/throws, deleted session not in list
- [x] T026 [US4] Implement `--delete-session <id>` handler in `src/index.tsx` — when flag is set, load session metadata, display confirmation prompt ("Delete session {id}? ({N} exchanges, last active {date})\nType 'yes' to confirm:"), read stdin for confirmation, call `sessionManager.deleteSession(id)` on "yes", print success/cancel message, exit — see `contracts/cli-interface.md`
- [x] T027 [US4] Handle deletion of non-existent session — when `--delete-session <id>` references an invalid ID, print error to stderr ("Error: Session \"{id}\" not found.") and exit with code 1

---

## Phase 7: Polish & Cross-Cutting Concerns

- [x] T028 Verify no regression on existing features — manually test or write integration checks: scratchpad JSONL files still created per query, `/model` command still works, input history navigation (up/down arrow) still works, `exit`/`quit` commands work, Ctrl+C cancellation works — all in `src/cli.ts` context with SessionManager active

---

## Dependencies

```
T001 ──> T002 ──> T003 (parallel with T004, T005)
                  T004 ──> T007
                  T005 ──> T008
                  T003 ──> T006

T004 + T005 + T003 ──> T009 ──> T010
T009 ──> T011 ──> T012 ──> T013 ──> T014   (US1 chain)

T014 ──> T015 ──> T016
T015 ──> T017 ──> T018 ──> T019             (US2 chain)

T009 ──> T020 ──> T021
T020 ──> T022 ──> T023                      (US3 chain, parallel with US2)

T009 ──> T024 ──> T025
T024 ──> T026 ──> T027                      (US4 chain, parallel with US2 & US3)

T019 + T023 + T027 ──> T028                 (Polish after all stories)
```

## Parallel Execution Opportunities

### Within Phase 2 (Foundational):
- **Parallel group A**: T003 (id.ts) + T004 (session-store.ts) + T005 (session-history.ts) — all depend only on T002 (types)
- **Parallel group B**: T006 (id test) + T007 (store test) + T008 (history test) — each depends on its source file only

### Across User Stories (Phase 4-6):
- **US3** (Session Listing) can start in parallel with **US2** (Session Resumption) after US1 completes
- **US4** (Session Deletion) can start in parallel with **US2** and **US3** after US1 completes
- Only **T028** (Polish) requires all stories to be complete

## Implementation Strategy

### MVP Scope (US1 only — Phases 1-3)
The minimum viable increment is **US1: Automatic Session Creation & Persistence** (T001–T014). After this phase:
- Every new Dexter session auto-generates an ID and saves exchanges to disk
- Users see their session ID in the banner
- Session data is crash-resilient (JSONL append-only)
- Foundation is laid for all subsequent stories

### Incremental Delivery
1. **MVP**: US1 (14 tasks) — sessions are created and persisted
2. **Core value**: + US2 (5 tasks) — sessions can be resumed
3. **Discovery**: + US3 (4 tasks) — sessions can be listed
4. **Management**: + US4 (4 tasks) — sessions can be deleted
5. **Hardening**: + Polish (1 task) — regression verification
