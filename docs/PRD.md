# PRD: Dexter

An autonomous financial research agent that thinks, plans, and learns as it works. It performs analysis using task planning, self-reflection, and real-time market data.

## Implementation Status

All P0 features are implemented. See status markers below.

## User Stories

### P0: Core Research Workflow (Must Have) — ✅ Complete

**As a** user,
**I want** to ask complex financial questions and receive data-backed answers,
**So that** I can make informed financial decisions.

- [P0-US1] ✅ Interactive CLI mode via `bun start` and `bun dev` (watch mode)
- [P0-US2] ✅ Task planning: decomposes complex queries into structured research steps
- [P0-US3] ✅ Autonomous tool selection and execution for financial data gathering
- [P0-US4] ✅ Self-validation: checks work and iterates until tasks are complete
- [P0-US5] ✅ Real-time financial data access (income statements, balance sheets, cash flow)
- [P0-US6] ✅ Safety features: loop detection and step limits

**Acceptance Criteria:**
- User can start interactive session with `bun start`
- Agent decomposes financial questions into research steps
- Agent selects appropriate tools (Financial Datasets API, web search)
- Agent validates results and refines until confident answer

### P0: Multi-Provider LLM Support (Must Have) — ✅ Complete

**As a** user,
**I want** to use different LLM providers,
**So that** I can choose based on cost/performance needs.

- [P0-US7] ✅ OpenAI API support
- [P0-US8] ✅ Anthropic API support (Claude)
- [P0-US9] ✅ Google GenAI support
- [P0-US10] ✅ Ollama local model support

**Acceptance Criteria:**
- All LLM providers configured via environment variables
- Graceful fallback if primary provider fails

### P0: Debugging & Observability (Must Have) — ✅ Complete

**As a** developer,
**I want** detailed logs of agent reasoning and tool execution,
**So that** I can debug issues.

- [P0-US11] ✅ Scratchpad JSONL files in `.dexter/scratchpad/`
- [P0-US12] ✅ Each query creates separate JSONL file with timestamp
- [P0-US13] ✅ Log entries: init, tool_result (with args, raw result, LLM summary), thinking

**Acceptance Criteria:**
- Every query produces debuggable JSONL file
- Tool calls include arguments, raw results, and LLM summaries

### P1: Evaluation Framework (Should Have) — ✅ Complete

**As a** operator,
**I want** to measure agent accuracy on financial questions,
**So that** I can track improvement over time.

- [P1-US1] ✅ Eval runner via `bun run src/evals/run.ts`
- [P1-US2] ✅ LangSmith integration for tracking
- [P1-US3] ✅ LLM-as-judge scoring approach
- [P1-US4] ✅ Real-time UI showing progress, current question, accuracy stats

**Acceptance Criteria:**
- Can run evals on all questions or random sample
- Results logged to LangSmith for analysis

### P1: WhatsApp Integration (Should Have) — ✅ Complete

**As a** user,
**I want** to chat with Dexter via WhatsApp,
**So that** I can get financial research on the go.

- [P1-US5] ✅ WhatsApp gateway via `bun run gateway`
- [P1-US6] ✅ QR code login via `bun run gateway:login`
- [P1-US7] ✅ Self-chat mode: message yourself on WhatsApp, get responses

**Acceptance Criteria:**
- Can link WhatsApp account via QR scan
- Messages to self are processed and responded to

### P2: Web Search (Could Have) — ✅ Complete

**As a** user,
**I want** access to web search for latest financial news,
**So that** I can get up-to-date information.

- [P2-US1] ✅ Exa API support for web search
- [P2-US2] ✅ Tavily as fallback search provider

**Acceptance Criteria:**
- Agent can search the web for recent financial information

## Architecture

### Components

| Component | File | Role |
|-----------|------|------|
| Main Entry | `src/index.tsx` | CLI entry point, TUI initialization |
| TUI | `src/ui/` | Terminal user interface using pi-tui |
| Agent | `src/agent/` | Core agent logic with task planning |
| Tools | `src/tools/` | Financial data and search tools |
| Gateway | `src/gateway/` | WhatsApp integration |
| Evals | `src/evals/` | Evaluation framework |

### Supported LLM Providers

- OpenAI (`OPENAI_API_KEY`)
- Anthropic (`ANTHROPIC_API_KEY`)
- Google GenAI (`GOOGLE_API_KEY`)
- xAI (`XAI_API_KEY`)
- OpenRouter (`OPENROUTER_API_KEY`)
- Ollama (local) (`OLLAMA_BASE_URL`)

### Data Sources

- **Financial Datasets API**: Income statements, balance sheets, cash flow
- **Exa API**: Web search (preferred)
- **Tavily API**: Web search (fallback)

### Running Dexter

```bash
# Interactive mode
bun start

# Watch mode for development
bun dev

# WhatsApp gateway
bun run gateway:login  # Link account (scan QR)
bun run gateway        # Start gateway

# Evaluation
bun run src/evals/run.ts
bun run src/evals/run.ts --sample 10
```

## Non-Functional Requirements

### Performance
- Step limits prevent runaway execution
- Loop detection stops infinite tool call cycles
- Eval sample mode for quick testing

### Security
- API keys stored in `.env` file (gitignored)
- No credentials in code

### Reliability
- Graceful error handling for API failures
- Fallback to alternative providers when available

## Test Scenarios

1. **Happy path**: Start `bun start`, ask financial question, verify data-backed answer
2. **Task planning**: Ask complex multi-part question, verify decomposed steps
3. **Self-validation**: Provide incomplete data, verify agent refines answer
4. **Debug**: Run query, check `.dexter/scratchpad/` for JSONL logs
5. **Eval**: Run `bun run src/evals/run.ts --sample 10`, verify LangSmith results
6. **WhatsApp**: Link account, message self, verify response
