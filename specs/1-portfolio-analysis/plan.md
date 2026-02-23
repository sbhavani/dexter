# Portfolio Analysis Implementation Plan

## Feature: Portfolio Analysis
**Branch**: `1-portfolio-analysis`
**Spec**: `specs/1-portfolio-analysis/spec.md`

---

## Technical Context

### Stack
- **Runtime**: Bun (v1.0+) with TypeScript
- **LLM Framework**: LangChain (Anthropic, OpenAI, Google GenAI, Ollama)
- **Validation**: Zod for schema validation
- **Testing**: Bun test, Jest
- **Financial Data API**: Existing `/prices/` endpoint for historical data

### Entities from Spec
- Stock Ticker (symbol, name, price data)
- Portfolio (tickers, date range, weighting)
- Performance Metrics (returns, rankings)
- Risk Metrics (volatility, Sharpe ratio, beta, VaR)
- Correlation Data (matrix, pairwise coefficients)

### Integration Points
- Use existing `get_prices` tool for historical price data
- Use existing `get_price_snapshot` for current prices
- Leverage existing API caching infrastructure

### Dependencies
- Financial Datasets API (existing)
- No additional external APIs required

---

## Constitution Check

### I. Test-First (NON-NEGOTIABLE)
**Status**: SATISFIED
- Tests will verify correctness of portfolio calculations before implementation
- Test cases cover agent behavior, calculation accuracy, and edge cases

### II. CLI-First Interface
**Status**: SATISFIED
- Portfolio analysis will be exposed via CLI commands
- Support JSON output for scripting and human-readable format

### III. Observability
**Status**: SATISFIED
- Use existing scratchpad system for debugging
- Track portfolio analysis queries in JSONL format

### IV. Safety & Loop Prevention
**Status**: SATISFIED
- Rate limiting for API calls
- Input validation prevents invalid portfolios

### V. Simplicity (YAGNI)
**Status**: SATISFIED
- Start with basic portfolio metrics
- Add visualization/export only when core is working

---

## Research (Phase 0)

### Research Completed
No additional research needed - spec had no NEEDS CLARIFICATION markers. All technical decisions are based on:

1. **Financial Calculations**: Standard formulas for Sharpe ratio, beta, correlation, VaR are well-established
2. **Data Source**: Existing `/prices/` API endpoint provides required historical data
3. **Benchmark**: S&P 500 (^GSPC) available via existing price API

---

## Implementation Phases

### Phase 1: Core Data Infrastructure

#### Task 1.1: Portfolio Input Module
- Create `PortfolioInput` schema with Zod validation
- Support ticker list parsing (comma/space/newline separated)
- Validate tickers against known symbols
- **Acceptance**: Can parse "AAPL, GOOGL MSFT" into validated array

#### Task 1.2: Price Data Aggregation
- Create service to fetch historical prices for multiple tickers
- Handle API rate limiting with queue
- Cache price data to reduce API calls
- **Acceptance**: Fetch 365 days of data for 10 tickers in under 10 seconds

#### Task 1.3: Data Model Types
- Define TypeScript interfaces for portfolio, metrics, correlation
- Ensure type safety across all calculations
- **Acceptance**: All types pass TypeScript strict mode

### Phase 2: Financial Calculations

#### Task 2.1: Performance Metrics Engine
- Calculate daily returns from price data
- Compute total return and annualized return
- Generate performance rankings
- **Acceptance**: Matches benchmark calculations (e.g., Yahoo Finance)

#### Task 2.2: Risk Metrics Engine
- Calculate volatility (standard deviation of returns)
- Calculate Sharpe ratio (using 4.5% risk-free rate)
- Calculate beta against S&P 500
- Calculate portfolio-level risk aggregation
- **Acceptance**: Matches benchmark calculations

#### Task 2.3: Correlation Analysis Engine
- Calculate Pearson correlation coefficients
- Build correlation matrix for all ticker pairs
- Identify high/low correlation pairs
- **Acceptance**: Correlation matrix matches manual calculation

### Phase 3: CLI Integration

#### Task 3.1: Portfolio Command
- Create `portfolio` CLI command
- Accept tickers via argument or interactive prompt
- Support time period flags (1m, 3m, 6m, 1y, ytd)
- **Acceptance**: `dexter portfolio AAPL GOOGL MSFT --period 1y` works

#### Task 3.2: Output Formatting
- Display results in readable table format
- Support JSON output with `--json` flag
- Show performance rankings clearly
- **Acceptance**: Both human and JSON output work correctly

#### Task 3.3: Error Handling
- Handle invalid tickers gracefully
- Show user-friendly errors for API failures
- Provide retry suggestions
- **Acceptance**: Invalid ticker "INVALID123" shows clear error message

### Phase 4: Advanced Features (Post-MVP)

#### Task 4.1: Visualization
- Add performance chart generation
- Add correlation heatmap
- **Acceptance**: Charts render correctly in terminal

#### Task 4.2: Export
- CSV export functionality
- PDF report generation
- **Acceptance**: Exports open correctly in standard tools

---

## Contracts

### CLI Contract

```bash
# Basic usage
dexter portfolio <tickers...> [flags]

# Flags
--period, -p    Time period: 1m, 3m, 6m, 1y, ytd, custom
--json          Output as JSON
--benchmark     Custom benchmark symbol (default: ^GSPC)
--weights       Comma-separated portfolio weights
--export        Export format: csv, pdf
--help          Show help

# Examples
dexter portfolio AAPL GOOGL MSFT
dexter portfolio AAPL GOOGL --period 6m --json
dexter portfolio AAPL GOOGL MSFT --weights 0.5,0.3,0.2
```

### Output Schema (JSON)

```typescript
interface PortfolioAnalysis {
  portfolio: {
    tickers: string[];
    dateRange: { start: string; end: string };
    period: string;
  };
  performance: {
    ticker: string;
    totalReturn: number;
    annualizedReturn: number;
    ranking: number;
  }[];
  risk: {
    ticker: string;
    volatility: number;
    sharpeRatio: number;
    beta: number;
  }[];
  portfolioRisk: {
    volatility: number;
    sharpeRatio: number;
    valueAtRisk: number;
  };
  correlation: {
    matrix: number[][];
    tickers: string[];
  };
}
```

---

## Quickstart

```bash
# Analyze a portfolio
bun start portfolio AAPL GOOGL MSFT TSLA --period 1y

# JSON output for scripting
bun start portfolio AAPL GOOGL MSFT --json > analysis.json

# With custom weights
bun start portfolio AAPL GOOGL MSFT --weights 0.5,0.3,0.2
```

---

## Risks & Mitigations

| Risk | Impact | Mitigation |
|------|--------|------------|
| API rate limits | High | Implement request queue with delays |
| Insufficient data | Medium | Require minimum 30 days, show warning |
| Invalid tickers | Low | Validate before API calls |
| Calculation errors | High | Compare against benchmarks in tests |

---

## Timeline Estimate

- **Phase 1** (Data Infrastructure): 2-3 days
- **Phase 2** (Calculations): 3-4 days
- **Phase 3** (CLI Integration): 2-3 days
- **Phase 4** (Advanced): 2-3 days

**Total**: 9-13 days for full implementation
