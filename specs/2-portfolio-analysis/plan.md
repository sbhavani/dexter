# Portfolio Analysis Implementation Plan

**Feature**: Portfolio Analysis
**Branch**: 2-portfolio-analysis
**Created**: 2026-02-22

## Technical Context

### Overview
Add portfolio analysis capability that accepts multiple stock tickers and generates comparative analysis including relative performance, risk metrics, and correlation coefficients.

### Technology Decisions

| Component | Choice | Rationale |
|-----------|--------|-----------|
| Language | TypeScript | Matches existing codebase |
| Runtime | Bun | Per constitution |
| Tool Framework | LangChain DynamicStructuredTool | Same as existing finance tools |
| Validation | Zod | Per constitution |
| Data Source | Financial Datasets API (existing) | Already integrated |
| Pattern | Agentic orchestration (like createFinancialMetrics) | Leverages existing multi-tool routing |

### Architecture

```
User Query → Portfolio Analysis Tool → get_prices (parallel for each ticker)
                                    → Calculate metrics locally
                                    → Return formatted analysis
```

### Unknowns / Risks

| Item | Risk | Mitigation |
|------|------|------------|
| API rate limits for 20 tickers | High | Batch requests, add delays, cache aggressively |
| Correlation calculation accuracy | Medium | Test with known correlation pairs |
| Performance for large portfolios | Medium | Set 30s timeout, paginate if needed |

## Constitution Check

| Principle | Status | Notes |
|-----------|--------|-------|
| I. Test-First | ✅ | Will create tests before implementation |
| II. CLI-First | ✅ | Tool output via formatToolResult (JSON/text) |
| III. Observability | ✅ | Uses existing scratchpad/logging |
| IV. Safety & Loop Prevention | ✅ | Add timeout for batch API calls |
| V. Simplicity (YAGNI) | ✅ | Reuses existing get_prices, adds only correlation math |

**Gate Evaluation**: All gates pass. No violations identified.

## Phase 1: Design

### Data Model

See [data-model.md](./data-model.md) for detailed entity definitions.

### Key Design Decisions

1. **Parallel Price Fetching**: Use `Promise.all` with `get_prices` for each ticker to minimize latency
2. **Correlation Calculation**: Pearson coefficient computed client-side using returned price arrays
3. **Risk Metrics**: Standard deviation, max drawdown, Sharpe ratio computed from return arrays
4. **Tool Factory Pattern**: Follow `createFinancialMetrics` pattern for model-agnostic tool creation

### API Contracts

The tool uses existing `/prices/` endpoint. No new contracts needed.

### Quickstart

See [quickstart.md](./quickstart.md) for usage guide.

## Phase 2: Implementation Tasks

### Task Structure

1. **Create portfolio analysis utility module** (`src/utils/portfolio-metrics.ts`)
   - `calculateReturns(priceData[]): number[]`
   - `calculateCorrelation(returns1[], returns2[]): number`
   - `calculateStandardDeviation(returns[]): number`
   - `calculateMaxDrawdown(returns[]): number`
   - `calculateSharpeRatio(returns[], riskFreeRate): number`
   - `buildCorrelationMatrix(priceDataByTicker): CorrelationMatrix`

2. **Create portfolio tool** (`src/tools/finance/portfolio.ts`)
   - Input schema with tickers array and period
   - Parallel fetch prices for all tickers
   - Compute all metrics
   - Format and return results

3. **Add tests** (`src/tools/finance/portfolio.test.ts`)
   - Test metric calculations with known values
   - Test correlation matrix generation
   - Test edge cases (single ticker, invalid tickers)

4. **Export from index** (`src/tools/finance/index.ts`)

### Dependencies

- `src/tools/finance/prices.ts` - existing get_prices tool
- `src/tools/finance/api.ts` - existing API client
- `src/tools/types.ts` - formatToolResult

### No Research Required

All technical questions resolved from existing codebase patterns. No external research needed.
