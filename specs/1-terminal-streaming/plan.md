# Implementation Plan: Terminal Streaming Response Mode

**Branch**: 1-terminal-streaming
**Feature**: Terminal Streaming Response Mode
**Created**: 2026-02-22

## Technical Context

### Architecture Overview

The current Dexter architecture has the following relevant components:

1. **Agent** (`src/agent/agent.ts`): Runs the agent loop, emits events (thinking, tool_start, tool_end, answer_start, done)
2. **AgentRunnerController** (`src/controllers/agent-runner.ts`): Handles agent events, updates UI state via callbacks
3. **LLM Layer** (`src/model/llm.ts`): Already supports streaming via LangChain's `streaming: true` option
4. **Theme System** (`src/theme.ts`): Uses chalk for ANSI color codes
5. **TUI**: Uses @mariozechner/pi-tui for terminal UI

### Data Flow

```
User Query → AgentRunnerController.runQuery()
           → Agent.create() + agent.run()
           → for await (const event of stream) { handleEvent(event) }
           → onChange callback → UI update
```

### Key Entities (from Spec)

- **Stream Controller**: Manages token flow from thinking, tools, final answer
- **ANSI Renderer**: Translates content to terminal output with escape codes
- **Output Buffer**: Ensures ordered delivery of concurrent streams

### Technology Decisions

| Component | Technology | Rationale |
|-----------|------------|-----------|
| Streaming | LangChain built-in | Already supported in getChatModel() |
| ANSI Colors | chalk | Already in use by theme.ts |
| Terminal Detection | isTTY + env vars | Standard Node.js pattern |
| Buffer | In-memory queue | Low complexity for single-session use |

### Constitution Check

| Principle | Assessment | Notes |
|-----------|------------|-------|
| CLI-First | ✓ Compatible | Streaming affects output rendering only |
| Observability | ✓ Maintained | Scratchpad logging unchanged |
| Safety | ✓ Preserved | Loop detection unchanged |
| Simplicity | ✓ YAGNI | Minimal new components |

### Dependencies

1. **LangChain Streaming**: Already available, just needs enabling
2. **Terminal Detection**: `process.stdout.isTTY` + `NO_COLOR` env var
3. **Event Augmentation**: Need to add delta events to AgentEvent types

---

## Phase 0: Research

### Research Tasks

#### RT-1: Terminal Streaming Best Practices

**Question**: What are the best practices for streaming output to terminals in Node.js?

**Findings**:
- Use character-level or word-level streaming (not line-level) for smooth animation
- Buffer small batches (5-20 chars) to balance responsiveness vs terminal overhead
- Use ANSI escape codes for colors and cursor positioning
- Detect non-interactive mode (piped/redirected) and disable streaming

**Decision**: Implement character-level streaming with small buffer (10 chars)
**Rationale**: Provides smoothest animation, matches user expectation of "token-by-token"
**Alternatives Considered**: Word-level (less smooth), line-level (too choppy)

#### RT-2: ANSI Escape Code Patterns

**Question**: How to implement ANSI color coding and cursor control for streaming?

**Findings**:
- Use chalk (already in use) for color coding
- Use ANSI escape sequences for cursor control: `\x1b[{n}A` (move up), `\x1b[K` (clear line)
- Use `\r` (carriage return) for overwriting current line

**Decision**: Use chalk for colors, raw ANSI for cursor control
**Rationale**: Consistent with existing theme system
**Alternatives Considered**: ncurses (too complex), blessed (not TUI-style)

#### RT-3: Streaming Detection

**Question**: How to detect when streaming should be disabled?

**Findings**:
- Check `process.stdout.isTTY` - false for piped/redirected output
- Check `NO_COLOR` env var - standard for disabling color
- Check `FORCE_NO_STREAM` for explicit disable

**Decision**: Disable streaming when !isTTY OR NO_COLOR is set
**Rationale**: Industry standard detection, maintains compatibility

---

## Phase 1: Design

### Data Model

#### New/Modified Types

```typescript
// New: Streaming configuration
interface StreamingConfig {
  enabled: boolean;
  bufferSize: number;        // default: 10
  showThinking: boolean;     // default: true
  showToolProgress: boolean; // default: true
}

// New: Delta events for incremental updates
interface ThinkingDeltaEvent {
  type: 'thinking_delta';
  delta: string;  // incremental thinking text
}

interface AnswerDeltaEvent {
  type: 'answer_delta';
  delta: string;  // incremental answer text
}

interface ToolResultDeltaEvent {
  type: 'tool_result_delta';
  toolId: string;
  delta: string;  // incremental tool result
}

// Modified: AgentEvent union
type AgentEvent =
  | ThinkingEvent | ThinkingDeltaEvent
  | ToolStartEvent | ToolProgressEvent | ToolEndEvent | ToolResultDeltaEvent
  | ToolErrorEvent | ToolApprovalEvent | ToolDeniedEvent | ToolLimitEvent
  | ContextClearedEvent | AnswerStartEvent | AnswerDeltaEvent | DoneEvent;
```

#### Entity: StreamController

| Field | Type | Description |
|-------|------|-------------|
| config | StreamingConfig | Streaming settings |
| buffer | string[] | Pending tokens to flush |
| outputTarget | WriteStream | Terminal stdout |

| Method | Description |
|--------|-------------|
| writeThinking(delta) | Stream thinking text |
| writeToolResult(toolId, delta) | Stream tool result |
| writeAnswer(delta) | Stream final answer |
| flush() | Flush remaining buffer |
| isEnabled() | Check if streaming active |

#### Entity: ANSIStreamRenderer

| Field | Type | Description |
|-------|------|-------------|
| streamController | StreamController | Output controller |
| colors | Theme | Color scheme |

| Method | Description |
|--------|-------------|
| renderThinking(text) | Render thinking with color |
| renderToolResult(text) | Render tool result with color |
| renderAnswer(text) | Render answer with color |
| clearLine() | Clear current line (for \r) |
| moveUp(lines) | Move cursor up n lines |

### Contracts

#### Streaming Toggle Contract

**User Action**: Enable/disable streaming
**Input**: `--stream` / `--no-stream` CLI flag
**Output**: StreamingConfig.enabled = true/false
**Validation**: If streaming disabled, fall back to block output

#### Terminal Detection Contract

**System**: Auto-detect streaming capability
**Checks**:
1. `process.stdout.isTTY === true`
2. `NO_COLOR` env var not set
3. `FORCE_STREAM` env var set (optional override)
**Output**: streaming enabled = boolean

#### Event Streaming Contract

**Source**: Agent events (ThinkingEvent, ToolEndEvent, DoneEvent)
**Transform**: Emit DeltaEvent for each chunk
**Output**: Stream to terminal with ANSI rendering

---

## Phase 2: Implementation Tasks

### Task Groups

#### Group A: Core Infrastructure

1. **A1**: Add StreamingConfig interface and CLI flag parsing
2. **A2**: Create StreamController class with buffer management
3. **A3**: Implement terminal detection logic (isTTY + NO_COLOR)
4. **A4**: Add DeltaEvent types to AgentEvent union

#### Group B: Agent Integration

5. **B1**: Modify Agent to emit thinking deltas during LLM streaming
6. **B2**: Modify Agent to emit tool result deltas (if tool supports streaming)
7. **B3**: Modify Agent to emit answer deltas during final answer generation
8. **B4**: Update AgentRunnerController to handle DeltaEvents

#### Group C: Rendering

9. **C1**: Create ANSIStreamRenderer class
10. **C2**: Integrate with theme system for colors
11. **C3**: Implement graceful degradation (block output fallback)
12. **C4**: Add cursor control for smooth animation

#### Group D: Testing

13. **D1**: Add unit tests for StreamController
14. **D2**: Add unit tests for terminal detection
15. **D3**: Add integration test for streaming mode
16. **D4**: Verify graceful degradation

### Dependencies

```
A1 ─┬─► B1 ─┬─► C1 ─┬─► D1
A2 ─┤       │       │
A3 ─┤       │       │
A4 ─┘   B2 ─┤   C2 ─┤   D2
        B3 ─┤   C3 ─┤   D3
        B4 ─┘   C4 ─┘   D4
```

### Quickstart Guide

After implementation, users can enable streaming:

```bash
# Enable streaming (default when terminal supports)
bun start --stream

# Disable streaming
bun start --no-stream

# In config file (.env)
DEXTER_STREAM=true
```

---

## Unresolved Items

None. All technical decisions have been resolved through research.

---

## Next Steps

Proceed to `/speckit.tasks` to generate dependency-ordered task list.
