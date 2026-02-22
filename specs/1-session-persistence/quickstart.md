# Quickstart: Session Persistence Implementation

**Feature**: 1-session-persistence
**Date**: 2026-02-22

## Overview

This guide provides a high-level implementation roadmap for adding session persistence to Dexter's CLI. The implementation builds on three existing patterns: Scratchpad (JSONL append-only logging), LongTermChatHistory (JSON persistence), and the gateway session store (metadata indexing).

## Key Files to Create

| File | Purpose |
|------|---------|
| `src/sessions/session-store.ts` | Session metadata index (CRUD operations) |
| `src/sessions/session-history.ts` | Per-session JSONL conversation persistence |
| `src/sessions/session-manager.ts` | Orchestrates store + history + InMemoryChatHistory |
| `src/sessions/types.ts` | TypeScript types and Zod schemas |
| `src/sessions/id.ts` | Session ID generation (8-char nanoid) |

## Key Files to Modify

| File | Change |
|------|--------|
| `src/index.tsx` | Parse CLI arguments before calling `runCli()` |
| `src/cli.ts` | Accept session options, wire SessionManager into controllers |
| `src/controllers/agent-runner.ts` | Emit exchange-complete events for session persistence |

## Implementation Order

### Step 1: Types and ID Generation
Define `SessionMetadata`, `SessionExchange`, `SessionIndex` types with Zod validation. Implement nanoid-style ID generation using Bun's crypto.

### Step 2: Session Store
Implement `SessionStore` class following the gateway `store.ts` pattern:
- `load()` / `save()` for index.json
- `create()` / `get()` / `list()` / `delete()` / `update()` for metadata
- Store at `.dexter/sessions/index.json`

### Step 3: Session History
Implement `SessionHistory` class following the Scratchpad JSONL pattern:
- `append(exchange)` — write one JSONL line
- `load()` — parse JSONL with resilient line-by-line parsing
- Files at `.dexter/sessions/cli/{id}/history.jsonl`

### Step 4: Session Manager
Orchestrate session lifecycle:
- `startNew()` — generate ID, create metadata, initialize history file
- `resume(id)` — load metadata + history, replay into InMemoryChatHistory
- `saveExchange(item)` — append to history JSONL, update metadata index
- `listSessions()` / `deleteSession(id)` — delegate to store

### Step 5: CLI Argument Parsing
Parse `process.argv` in `src/index.tsx` before `runCli()`:
- `--session <id>` → pass to runCli options
- `--list-sessions` → print and exit
- `--delete-session <id>` → confirm, delete, and exit

### Step 6: Wire into TUI
Modify `src/cli.ts` to:
- Accept session options from parsed args
- Initialize SessionManager (new or resume)
- Display session ID in intro banner
- Hook exchange persistence into the query completion flow
- Display prior exchanges on resume

### Step 7: Tests
Write tests following existing patterns (`bun test`):
- Session store CRUD operations
- JSONL history append and resilient load
- Session manager lifecycle (create, save, resume, delete)
- CLI argument parsing
- Context reconstruction with InMemoryChatHistory

## Constitution Compliance Notes

- **Test-First**: All new modules need tests before/alongside implementation
- **CLI-First**: Session flags follow existing CLI conventions; JSON output for scripting
- **Observability**: Session persistence complements (does not replace) Scratchpad
- **Safety**: No new autonomous agent behavior; session management is user-initiated
- **Simplicity**: No external dependencies; hand-rolled arg parsing; JSONL format reuse
