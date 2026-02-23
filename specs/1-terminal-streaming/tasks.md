# Tasks: Terminal Streaming Response Mode

**Feature**: Terminal Streaming Response Mode
**Branch**: 1-terminal-streaming
**Generated**: 2026-02-22

## Overview

This feature implements token-by-token streaming of agent thinking and tool results to the terminal using ANSI escape codes.

### User Stories

| Story | Priority | Description |
|-------|----------|-------------|
| US1 | P1 | Real-time Thinking Display |
| US2 | P2 | Live Tool Execution Feedback |
| US3 | P3 | Progressive Answer Building |

### Total Task Count: 18

---

## Phase 1: Setup

No setup tasks required. Existing project structure is compatible.

---

## Phase 2: Foundational

Core infrastructure that must be completed before any user story implementation.

- [x] T001 Add StreamingConfig interface in src/streaming/types.ts
- [x] T002 Add DeltaEvent types (ThinkingDeltaEvent, AnswerDeltaEvent, ToolResultDeltaEvent) to src/agent/types.ts
- [x] T003 Implement terminal detection logic in src/streaming/terminal-detection.ts
- [x] T004 Create StreamController class in src/streaming/stream-controller.ts

**Independent Test Criteria**: Terminal detection correctly identifies TTY vs non-TTY; StreamController buffers and flushes tokens correctly.

---

## Phase 3: US1 - Real-time Thinking Display

**Goal**: Users see agent thinking as it happens, token-by-token
**Priority**: P1
**Dependencies**: Phase 2 complete

### Implementation Tasks

- [x] T005 [P] [US1] Create ANSIStreamRenderer class in src/streaming/ansi-renderer.ts
- [x] T006 [US1] Modify LLM layer to enable streaming in src/model/llm.ts
- [x] T007 [US1] Update Agent to emit thinking deltas during LLM streaming in src/agent/agent.ts
- [x] T008 [US1] Update AgentRunnerController to handle ThinkingDeltaEvent in src/controllers/agent-runner.ts
- [x] T009 [US1] Connect StreamController to AgentRunnerController for thinking output in src/controllers/agent-runner.ts

**Independent Test Criteria**: Thinking text appears incrementally as agent processes; 100ms latency target met.

### Parallel Opportunities

- T005 (ANSIStreamRenderer) is independent and can be done in parallel with T006-T009

---

## Phase 4: US2 - Live Tool Execution Feedback

**Goal**: Users see tool execution progress as data comes in
**Priority**: P2
**Dependencies**: Phase 2 complete, US1 T009 complete

### Implementation Tasks

- [x] T010 [P] [US2] Add tool result delta emission to tool-executor in src/agent/tool-executor.ts
- [x] T011 [US2] Add ToolResultDeltaEvent handler in AgentRunnerController in src/controllers/agent-runner.ts
- [x] T012 [US2] Render tool result deltas with ANSIStreamRenderer in src/controllers/agent-runner.ts

**Independent Test Criteria**: Tool results appear progressively; user sees confirmation agent is working.

### Parallel Opportunities

- T010 is independent of T011-T012 after Phase 2

---

## Phase 5: US3 - Progressive Answer Building

**Goal**: Final answer builds token-by-token on screen
**Priority**: P3
**Dependencies**: Phase 2 complete, US1 complete

### Implementation Tasks

- [x] T013 [US3] Add answer delta emission during final answer generation in src/agent/agent.ts
- [x] T014 [US3] Add AnswerDeltaEvent handler in AgentRunnerController in src/controllers/agent-runner.ts
- [x] T015 [US3] Render answer deltas with ANSIStreamRenderer in src/controllers/agent-runner.ts

**Independent Test Criteria**: Final answer appears incrementally; user sees progress toward completion.

---

## Phase 6: Polish & Cross-Cutting Concerns

- [x] T016 [P] Add --stream / --no-stream CLI flag parsing in src/cli.ts
- [x] T017 [P] Implement graceful degradation (block output fallback) in src/streaming/stream-controller.ts
- [x] T018 Add cursor control for smooth animation (clearLine, moveUp) in src/streaming/ansi-renderer.ts

---

## Implementation Strategy

### MVP Scope (US1 only)

The MVP includes Phases 2 and 3 (T001-T009). This delivers:
- Token-by-token thinking display
- Terminal detection
- Graceful degradation

### Incremental Delivery

| Increment | Stories | Tasks | Value |
|-----------|---------|-------|-------|
| 1 (MVP) | US1 | T001-T009 | Real-time thinking display |
| 2 | US2 | T010-T012 | Live tool execution feedback |
| 3 | US3 | T013-T015 | Progressive answer building |
| 4 | Polish | T016-T018 | CLI flags, graceful degradation |

### Dependencies Graph

```
Phase 2 (Foundational)
├── T001: StreamingConfig
├── T002: DeltaEvent types
├── T003: Terminal detection ────┐
└── T004: StreamController        │
                                ├──► Phase 3 (US1)
Phase 4 (US2)                         T005-T009
├── T010: Tool delta emission ────────────┤
├── T011: Handler
└── T012: Render

Phase 5 (US3)
├── T013: Answer delta emission
├── T014: Handler
└── T015: Render

Phase 6 (Polish)
├── T016: CLI flags
├── T017: Graceful degradation
└── T018: Cursor control
```

---

## File Paths Summary

| Task | File |
|------|------|
| T001 | src/streaming/types.ts |
| T002 | src/agent/types.ts |
| T003 | src/streaming/terminal-detection.ts |
| T004 | src/streaming/stream-controller.ts |
| T005 | src/streaming/ansi-renderer.ts |
| T006 | src/model/llm.ts |
| T007 | src/agent/agent.ts |
| T008 | src/controllers/agent-runner.ts |
| T009 | src/controllers/agent-runner.ts |
| T010 | src/agent/tool-executor.ts |
| T011 | src/controllers/agent-runner.ts |
| T012 | src/controllers/agent-runner.ts |
| T013 | src/agent/agent.ts |
| T014 | src/controllers/agent-runner.ts |
| T015 | src/controllers/agent-runner.ts |
| T016 | src/cli.ts |
| T017 | src/streaming/stream-controller.ts |
| T018 | src/streaming/ansi-renderer.ts |
