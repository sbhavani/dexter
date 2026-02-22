# Research: Session Persistence

**Feature**: 1-session-persistence
**Date**: 2026-02-22

## R1: Session ID Generation Strategy

**Decision**: Use 8-character nanoid (alphanumeric, lowercase) for session IDs.

**Rationale**: The spec requires human-friendly, short, easily-typed IDs. Nanoid provides collision-resistant random IDs without external dependencies (Bun has built-in crypto). 8 lowercase alphanumeric characters yield 36^8 ≈ 2.8 trillion combinations — sufficient for local-only session stores. The existing codebase uses `Date.now().toString()` for IDs (LongTermChatHistory) and MD5 hashes (Scratchpad), but neither pattern produces typeable session IDs.

**Alternatives considered**:
- UUID v4: Too long (36 chars) for CLI typing
- Timestamp-based: Not human-friendly, collision-prone in automated workflows
- Sequential integers: Simple but leak session count information
- Custom word-based (e.g., adjective-noun): Requires word list dependency

## R2: Session File Format

**Decision**: JSONL (newline-delimited JSON) for conversation data; JSON for session metadata index.

**Rationale**: JSONL is proven crash-resilient in the existing Scratchpad system. Each exchange is appended as a single line, so incomplete writes only corrupt the last entry. The Scratchpad already demonstrates resilient JSONL parsing that skips malformed lines (`parseLine()` in `src/agent/scratchpad.ts`). A separate JSON metadata index (similar to gateway's `sessions.json`) enables fast session listing without parsing all JSONL files.

**Alternatives considered**:
- Single JSON file: Entire file must be rewritten on each exchange — not crash-resilient
- SQLite: Over-engineered for local CLI tool, adds binary dependency
- Binary format (MessagePack): Not human-readable, harder to debug

## R3: Session Storage Layout

**Decision**: Store sessions under `.dexter/sessions/` with one directory per session.

**Rationale**: Follows the existing `.dexter/` convention (`.dexter/messages/`, `.dexter/scratchpad/`, `.dexter/settings.json`). One directory per session allows clean deletion and future extensibility (e.g., attachments). The gateway already uses `.dexter/sessions/` for WhatsApp sessions but with a different subdirectory structure (`agentId/sessions.json`); CLI sessions will use `cli/{sessionId}/` to avoid conflicts.

**Layout**:
```
.dexter/sessions/
├── index.json              # Session metadata index (all sessions)
└── cli/
    ├── {sessionId}/
    │   └── history.jsonl   # Conversation exchanges
    └── {sessionId}/
        └── history.jsonl
```

**Alternatives considered**:
- Flat files (one JSONL per session in a single directory): Harder to manage metadata, deletion requires parsing filenames
- Global home directory (`~/.dexter/`): Gateway uses this for cross-project data, but CLI sessions are project-scoped

## R4: CLI Argument Parsing Approach

**Decision**: Use minimal `process.argv` parsing without external libraries.

**Rationale**: The constitution mandates simplicity (YAGNI). The gateway already parses `process.argv.slice(2)` for subcommands. Only three flags are needed: `--session <id>`, `--list-sessions`, and `--delete-session <id>`. A simple hand-rolled parser matches the existing codebase style. The eval runner also uses manual `process.argv` parsing for `--sample`.

**Alternatives considered**:
- Commander.js / yargs: Over-engineered for 3 flags, adds dependency
- Bun's built-in arg parser: Not yet stable/documented
- Subcommand pattern (like gateway): Doesn't match TUI's primary use case where flags modify the default interactive mode

## R5: Context Reconstruction on Resume

**Decision**: Replay full conversation into InMemoryChatHistory; use existing token-limit handling for context window management.

**Rationale**: InMemoryChatHistory already has `selectRelevantMessages()` which uses LLM-based relevance scoring to pick which prior messages to include in context. On resume, replaying all prior exchanges into InMemoryChatHistory allows the existing relevance selection to work naturally. For very long sessions (50+ exchanges), the existing context-clearing strategy (`clearOldestToolResults()`) prevents context window overflow. No new summarization logic is needed because InMemoryChatHistory already generates summaries per exchange.

**Alternatives considered**:
- Pre-computed session summary: Adds complexity, InMemoryChatHistory already summarizes
- Sliding window (last N exchanges only): Loses long-range context that relevance selection preserves
- Lazy loading with pagination: Over-engineered for expected session sizes (<100 exchanges)

## R6: Concurrency and File Locking

**Decision**: No file locking; display warning if session is already active.

**Rationale**: The spec assumes single-instance access. A simple approach: write a `.lock` file when a session is active, check on resume, warn if stale. This matches the project's simplicity principle. True file locking (flock/lockfile) is platform-dependent and over-engineered for the use case.

**Alternatives considered**:
- flock-based locking: Platform-specific, complex
- PID-based lock files: Simple but can become stale on crash
- No protection at all: Risk of file corruption if two instances write simultaneously

## R7: HistoryItem Serialization

**Decision**: Serialize a subset of HistoryItem fields (id, query, answer, status, startTime, duration, tokenUsage) and omit DisplayEvent details.

**Rationale**: DisplayEvent contains transient UI state (activeToolId, progressMessage) that is irrelevant on resume. The answer and query are the semantically meaningful data. Tool call details are already persisted by Scratchpad. Keeping the serialized format lean reduces file size and avoids serialization of complex event hierarchies.

**Alternatives considered**:
- Full HistoryItem serialization: Includes irrelevant UI state, inflates file size
- Query/answer pairs only: Loses useful metadata (duration, token usage)
- Reference Scratchpad files: Adds cross-file dependency complexity
