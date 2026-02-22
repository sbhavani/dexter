# Feature Specification: Session Persistence

**Version**: 1.0.0
**Status**: Draft
**Created**: 2026-02-22
**Feature Branch**: `1-session-persistence`

## Overview

### Problem Statement

When a user exits Dexter, all conversation context is lost. Multi-turn financial research sessions that build upon previous queries, reasoning, and tool results cannot be resumed. Users who are conducting deep research across multiple sittings must re-ask questions and rebuild context from scratch, wasting time and losing the continuity of complex analysis workflows.

### Proposed Solution

Introduce session persistence that automatically saves full conversation state to disk during use, and allows users to resume any previous session via a `--session <id>` CLI flag. Each session captures the complete conversation history including queries, agent responses, tool executions, and reasoning context, enabling seamless continuation of multi-turn research across application restarts.

### Target Users

- **Financial researchers** conducting multi-day analysis requiring continuity across sessions
- **Power users** running multiple parallel research threads who need to switch between topics
- **Automation integrators** scripting Dexter for batch workflows that may need to resume on failure

## Functional Requirements

### FR-1: Automatic Session Creation

When a user starts Dexter without the `--session` flag, a new session is automatically created with a unique identifier. The session begins recording all conversation activity from the first query.

**Acceptance Criteria:**
- A unique session ID is generated for every new interactive session
- The session ID is displayed to the user at session start so they can reference it later
- Session IDs are human-friendly (short, readable, easily typed or copied)
- No user action is required to initiate session saving; it happens transparently

### FR-2: Conversation History Persistence

The full conversation state is saved to disk incrementally as the session progresses. This includes user queries, agent responses, tool call details, and reasoning steps.

**Acceptance Criteria:**
- Each user query and its corresponding agent response are persisted after the response completes
- Tool call arguments and results are included in the persisted state
- Agent reasoning/thinking steps are captured
- Data is saved incrementally (append-style) so that a crash mid-session does not lose prior exchanges
- Persisted data is stored in the existing `.dexter/` data directory, following established conventions

### FR-3: Session Resumption via CLI Flag

Users can resume a previous session by launching Dexter with `--session <id>`, which restores the conversation context and allows the user to continue where they left off.

**Acceptance Criteria:**
- Running `dexter --session <id>` loads the specified session's conversation history
- The restored session displays prior conversation exchanges so the user has context
- New queries within the resumed session have access to the full prior conversation context
- The agent's responses in a resumed session reflect awareness of previous conversation turns
- If an invalid or non-existent session ID is provided, a clear error message is shown with guidance
- The resumed session continues saving new exchanges to the same session file

### FR-4: Session Listing

Users can view a list of all saved sessions with enough metadata to identify and select the one they want to resume.

**Acceptance Criteria:**
- A mechanism exists to list all available sessions (e.g., `--list-sessions` flag or similar)
- Each listed session shows: session ID, creation date/time, last activity date/time, and a preview of the first or most recent query
- Sessions are listed in reverse chronological order (most recent first)
- The list output is usable in both human-readable and machine-parseable formats (consistent with the project's CLI-first, JSON-output principle)

### FR-5: Session Metadata Tracking

Each session records metadata that supports listing, identification, and lifecycle management.

**Acceptance Criteria:**
- Metadata includes: session ID, creation timestamp, last activity timestamp, total number of exchanges, and the model/provider used
- Metadata is updated after each exchange within the session
- Metadata is stored alongside or within the session data file

### FR-6: Session Context Reconstruction

When resuming a session, the conversation context must be reconstructed in a way that respects token limits and provides the agent with relevant prior context.

**Acceptance Criteria:**
- Resumed sessions inject prior conversation history into the agent's context window
- If the full history exceeds the model's context window, the most recent and most relevant exchanges are prioritized (consistent with existing context-clearing behavior)
- Summary information from earlier exchanges is used to preserve long-range context when full history cannot fit
- The user experience upon resumption feels continuous, not disjointed

### FR-7: Session Deletion

Users can delete sessions they no longer need to manage disk usage and keep their session list manageable.

**Acceptance Criteria:**
- A mechanism exists to delete a specific session by ID
- Deletion removes both conversation data and metadata
- A confirmation step prevents accidental deletion
- Attempting to delete a non-existent session produces a clear error message

## User Scenarios & Testing

### Scenario 1: First-Time Session (Happy Path)

**Given** a user starts Dexter without any session flags
**When** they submit their first query
**Then** a new session is created automatically, the session ID is displayed, and the conversation is saved to disk after the response completes

### Scenario 2: Resume Previous Session

**Given** a user has a saved session with ID "abc123" containing 3 prior exchanges
**When** they run `dexter --session abc123`
**Then** the CLI loads and displays the prior conversation history, and the agent's next response reflects awareness of those previous exchanges

### Scenario 3: Continue Research Across Restart

**Given** a user asked "What is AAPL's P/E ratio?" in a session, received an answer, then exited
**When** they resume that session and ask "How does that compare to the sector average?"
**Then** the agent understands "that" refers to AAPL's P/E ratio from the prior exchange and provides a comparative answer

### Scenario 4: List Available Sessions

**Given** a user has 5 saved sessions from different research topics
**When** they run the session listing command
**Then** they see all 5 sessions listed with IDs, dates, and query previews in reverse chronological order

### Scenario 5: Invalid Session ID

**Given** a user runs `dexter --session nonexistent`
**When** the application attempts to load the session
**Then** a clear error message is displayed explaining the session was not found, and available session IDs are suggested

### Scenario 6: Session Survives Crash

**Given** a user has completed 3 exchanges in a session and the application crashes during the 4th
**When** they resume the session
**Then** all 3 completed exchanges are intact and the partial 4th exchange is either recovered or cleanly absent

### Scenario 7: Delete a Session

**Given** a user has a saved session they no longer need
**When** they invoke the session deletion mechanism with the session ID
**Then** the session is removed from disk and no longer appears in the session list

### Scenario 8: Token Limit Handling on Resume

**Given** a user resumes a session with 50+ prior exchanges that exceed the model's context window
**When** the context is reconstructed
**Then** the agent has access to summaries of older exchanges and full details of recent ones, maintaining conversational coherence

## Success Criteria

1. **Seamless continuity**: Users can resume a session and continue a multi-turn conversation as if they never left, with the agent demonstrating awareness of prior context
2. **Zero data loss on clean exit**: 100% of completed exchanges are persisted when the user exits normally
3. **Crash resilience**: At least all fully-completed exchanges prior to a crash are recoverable
4. **Fast session load**: Users can resume a session with up to 100 prior exchanges and begin interacting within 3 seconds
5. **Minimal storage overhead**: Session data for a typical research session (10-20 exchanges with tool results) occupies less than 5 MB on disk
6. **Discoverability**: Users can find and identify the session they want to resume within 10 seconds using the session listing feature
7. **No regression**: Existing functionality (new sessions without flags, scratchpad debugging, model switching) continues to work unchanged

## Scope

### In Scope

- Automatic session creation and persistence for CLI interactive mode
- CLI flag (`--session <id>`) for resuming sessions
- Session listing with metadata
- Session deletion
- Context reconstruction with token-limit awareness
- Incremental/crash-resilient saving

### Out of Scope

- Session sharing between users or machines
- Cloud-based session sync
- Session branching or forking (starting a new session from a point in an old one)
- WhatsApp gateway session persistence (gateway has its own session system)
- Session encryption or access control
- Automatic session expiry or cleanup policies
- Real-time collaboration on a session
- Session export to external formats (PDF, Markdown reports)

## Dependencies

- Existing `.dexter/` data directory conventions and file I/O patterns
- Existing `InMemoryChatHistory` conversation context system
- Existing `Scratchpad` JSONL logging system (as a pattern reference)
- Existing `LongTermChatHistory` persistence pattern
- CLI argument parsing (currently not implemented; will need to be introduced)

## Assumptions

- **Session storage location**: Sessions will be stored under `.dexter/sessions/` following the existing data directory convention, keeping session data local to the project directory
- **Session ID format**: IDs will be short, human-friendly strings (e.g., 8-character alphanumeric) rather than UUIDs, optimizing for easy typing in CLI contexts
- **Concurrency**: Only one instance of Dexter accesses a session at a time; no file locking is required
- **Disk space**: Users have sufficient local disk space for session files; no compression is applied by default
- **Backward compatibility**: Existing scratchpad files and chat history remain untouched; session persistence is an additive feature layered on top
- **CLI argument parsing**: A lightweight argument parsing approach will be introduced since the CLI currently has no flag handling; this will follow the project's simplicity principle (YAGNI)
- **Model switching within sessions**: If a user switches models mid-session (via `/model`), the new model is recorded in session metadata, and context reconstruction adapts to the new model's token limits

## Risks

| Risk | Likelihood | Impact | Mitigation |
|------|-----------|--------|------------|
| Large sessions cause slow resume times | Medium | Medium | Implement lazy loading; only load recent exchanges fully, summarize older ones |
| Session files grow unbounded on disk | Low | Medium | Include session size in listing metadata; provide deletion mechanism; consider future cleanup policies |
| Token limit differences across models complicate context reconstruction | Medium | Low | Use existing context-clearing strategy; adapt to active model's limits at resume time |
| Corrupted session file prevents resume | Low | High | Use append-only JSONL format for resilience; validate on load; skip corrupted entries gracefully |
