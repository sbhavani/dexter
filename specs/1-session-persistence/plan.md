# Implementation Plan: Session Persistence

**Feature**: 1-session-persistence
**Branch**: `1-session-persistence`
**Date**: 2026-02-22
**Status**: Draft

## Technical Context

### Codebase Overview

Dexter is a Bun/TypeScript CLI financial research agent with a pi-tui TUI interface. The relevant architecture:

- **Entry point**: `src/index.tsx` → calls `runCli()` from `src/cli.ts`
- **Controllers**: `AgentRunnerController` (conversation state), `InputHistoryController` (input history), `ModelSelectionController` (LLM selection)
- **Persistence**: Three existing systems —
  - `InMemoryChatHistory`: In-memory multi-turn context with LLM-generated summaries and relevance selection
  - `LongTermChatHistory`: JSON file at `.dexter/messages/chat_history.json` for input history navigation
  - `Scratchpad`: JSONL append-only log at `.dexter/scratchpad/` for tool call debugging
- **Types**: `HistoryItem` (query, answer, events, status, timing, token usage), `AgentEvent` union, `DisplayEvent`
- **Config**: `.dexter/settings.json` via `getSetting()`/`setSetting()` utilities
- **Gateway session store**: `src/gateway/sessions/store.ts` — JSON-based metadata store (pattern reference)
- **CLI arg parsing**: Not implemented in main CLI; gateway uses `process.argv.slice(2)` for subcommands

### Key Dependencies

| Dependency | Version | Usage |
|-----------|---------|-------|
| Bun runtime | 1.0+ | Runtime, test runner, crypto APIs |
| TypeScript | — | Type system |
| Zod | — | Schema validation (existing in project) |
| @mariozechner/pi-tui | 0.52.9 | TUI framework |
| LangChain | — | LLM framework for InMemoryChatHistory |

### Integration Points

1. **`src/index.tsx`**: Add CLI argument parsing before `runCli()` call
2. **`src/cli.ts`**: Accept session options, initialize SessionManager, wire persistence
3. **`src/controllers/agent-runner.ts`**: No modification needed — observe `HistoryItem` state from cli.ts
4. **InMemoryChatHistory**: Replay session exchanges into it on resume
5. **LongTermChatHistory**: Unchanged — continues parallel operation for input history
6. **Scratchpad**: Unchanged — continues per-query JSONL logging

## Constitution Check

### I. Test-First (NON-NEGOTIABLE)
**Status**: COMPLIANT
**Plan**: Tests for each new module (SessionStore, SessionHistory, SessionManager, CLI arg parsing) written alongside or before implementation. Use `bun test` with the existing test infrastructure.

### II. CLI-First Interface
**Status**: COMPLIANT
**Plan**: All session operations exposed via CLI flags (`--session`, `--list-sessions`, `--delete-session`). Output supports both human-readable and JSON formats (`--json` flag for `--list-sessions`).

### III. Observability
**Status**: COMPLIANT
**Plan**: Session persistence is additive. Scratchpad JSONL logging continues unchanged. Session files themselves add a new layer of observability (conversation history).

### IV. Safety & Loop Prevention
**Status**: NOT APPLICABLE
**Plan**: No new autonomous agent behavior. Session management is entirely user-initiated. Existing safety/loop prevention mechanisms are unaffected.

### V. Simplicity (YAGNI)
**Status**: COMPLIANT
**Plan**: No external dependencies added. Hand-rolled arg parsing (3 flags). JSONL format reused from Scratchpad. Gateway session store pattern reused. No over-abstraction — each module has a clear, single responsibility.

## Architecture

### New Modules

```
src/sessions/
├── types.ts              # Types + Zod schemas
├── id.ts                 # Session ID generation
├── session-store.ts      # Metadata index (CRUD)
├── session-history.ts    # Per-session JSONL persistence
└── session-manager.ts    # Orchestrator
```

### Data Flow

```
User starts dexter
  │
  ├─ No flags → SessionManager.startNew()
  │                ├─ Generate session ID
  │                ├─ Create metadata in index.json
  │                └─ Initialize empty history.jsonl
  │
  └─ --session <id> → SessionManager.resume(id)
                         ├─ Load metadata from index.json
                         ├─ Load exchanges from history.jsonl
                         ├─ Replay into InMemoryChatHistory
                         └─ Populate AgentRunner history for display

User submits query
  │
  └─ Agent completes → SessionManager.saveExchange()
                          ├─ Append to history.jsonl (crash-safe)
                          └─ Update metadata in index.json

User exits
  └─ No special action needed (data already persisted incrementally)
```

### Modified Data Flow

```
src/index.tsx
  │ Parse process.argv
  │ Handle --list-sessions (print & exit)
  │ Handle --delete-session (confirm, delete & exit)
  │ Pass sessionOptions to runCli()
  ▼
src/cli.ts (runCli)
  │ Create SessionManager
  │ startNew() or resume() based on sessionOptions
  │ Display session ID in intro banner
  │ On query completion: SessionManager.saveExchange()
  ▼
src/sessions/session-manager.ts
  │ Coordinates SessionStore + SessionHistory + InMemoryChatHistory
  ▼
src/sessions/session-store.ts          src/sessions/session-history.ts
  │ .dexter/sessions/index.json          │ .dexter/sessions/cli/{id}/history.jsonl
```

## Design Decisions

See [research.md](./research.md) for detailed rationale on each decision.

| Decision | Choice | Key Rationale |
|----------|--------|---------------|
| Session ID format | 8-char lowercase alphanumeric | Human-friendly, collision-resistant for local use |
| Conversation file format | JSONL | Crash-resilient append-only (proven by Scratchpad) |
| Metadata index format | JSON | Fast listing without parsing all JSONL files |
| Storage location | `.dexter/sessions/cli/{id}/` | Follows `.dexter/` convention, avoids gateway conflict |
| Arg parsing | Hand-rolled `process.argv` | YAGNI — only 3 flags needed |
| Context reconstruction | Replay into InMemoryChatHistory | Reuses existing relevance selection and summarization |
| Serialized exchange fields | id, timestamp, query, answer, summary, model, status, duration, tokenUsage | Lean format; omits transient UI state |

## Phase 1 Artifacts

- [research.md](./research.md) — All technical decisions with rationale and alternatives
- [data-model.md](./data-model.md) — Entity definitions, relationships, state transitions, file layout
- [contracts/cli-interface.md](./contracts/cli-interface.md) — CLI flag specifications, output formats, error handling
- [quickstart.md](./quickstart.md) — Implementation order and key file mapping

## Implementation Phases

### Phase 1: Foundation (Types, Store, History)
1. Create `src/sessions/types.ts` with Zod schemas for SessionMetadata, SessionExchange, SessionIndex
2. Create `src/sessions/id.ts` with nanoid-style ID generation
3. Create `src/sessions/session-store.ts` — metadata CRUD on index.json
4. Create `src/sessions/session-history.ts` — JSONL append/load for exchanges
5. Tests for all of the above

### Phase 2: Orchestration (SessionManager)
1. Create `src/sessions/session-manager.ts` — startNew, resume, saveExchange, list, delete
2. Implement context reconstruction (replay into InMemoryChatHistory)
3. Tests for SessionManager lifecycle

### Phase 3: CLI Integration
1. Add argument parsing to `src/index.tsx`
2. Implement `--list-sessions` (print & exit)
3. Implement `--delete-session` (confirm, delete & exit)
4. Modify `src/cli.ts` to accept session options and wire SessionManager
5. Display session ID in TUI intro banner
6. Hook exchange persistence into query completion flow
7. Display prior exchanges on resume
8. Integration tests

### Phase 4: Polish & Edge Cases
1. Handle edge cases: crash recovery, stale lock files, empty sessions
2. JSON output mode for `--list-sessions`
3. Session-not-found error with helpful suggestions
4. Verify no regression on existing functionality

## Risks and Mitigations

| Risk | Mitigation |
|------|------------|
| JSONL file corruption on crash | Resilient line-by-line parsing (skip malformed), proven by Scratchpad |
| Large session files slow resume | InMemoryChatHistory's relevance selection naturally handles long histories |
| Gateway session conflict | Separate path: `cli/` subdirectory vs gateway's `agentId/` subdirectory |
| Breaking existing tests | Session persistence is additive; no existing code paths modified except entry point |
| InMemoryChatHistory replay overhead | LLM summary generation already cached; replay reuses existing summaries from JSONL |

## Out of Scope (Confirmed)

Per the feature spec:
- Session sharing, cloud sync, branching/forking
- WhatsApp gateway session unification
- Session encryption or access control
- Automatic expiry or cleanup policies
- Export to external formats
