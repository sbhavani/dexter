# Dexter Constitution

## Core Principles

### I. Test-First (NON-NEGOTIABLE)
Financial accuracy is critical. Tests MUST verify correctness before implementation. The eval framework uses LLM-as-judge scoring - tests should cover agent behavior correctness, tool response accuracy, and reasoning validity.

### II. CLI-First Interface
All functionality is exposed via CLI. Text in/out protocol: stdin/args → stdout, errors → stderr. Support both JSON (for scripting) and human-readable formats. Commands: `bun start`, `bun dev`, `bun run gateway`.

### III. Observability
The scratchpad system (`./dexter/scratchpad/`) provides debugging and history tracking. Every query creates a JSONL file with init, tool_result, and thinking entries. This is the primary debugging mechanism - MUST be maintained.

### IV. Safety & Loop Prevention
Autonomous agents require safeguards. Built-in loop detection and step limits prevent runaway execution. Safety features are non-negotiable and MUST be tested.

### V. Simplicity (YAGNI)
Start simple, avoid premature abstraction. Architecture should remain lightweight - no organizational-only libraries or patterns. If complexity is added, it must be justified in the implementation plan.

## Technology Stack

**Runtime**: Bun (v1.0+) with TypeScript
**LLM Framework**: LangChain ( Anthropic, OpenAI, Google GenAI, Ollama)
**TUI**: @mariozechner/pi-tui
**Testing**: Bun test, Jest
**Validation**: Zod for schema validation
**External Data**: Financial Datasets API, Exa/Tavily for web search

**Version**: 1.0.0 | **Ratified**: 2026-02-20 | **Last Amended**: 2026-02-20
