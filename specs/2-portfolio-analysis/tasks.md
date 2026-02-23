# Portfolio Analysis - Implementation Tasks

**Feature**: Portfolio Analysis
**Branch**: 2-portfolio-analysis
**Generated**: 2026-02-22

## Implementation Strategy

### MVP Scope (Phase 3: US1)
The core portfolio analysis tool with multi-ticker input, performance metrics, and basic risk analysis. This provides immediate value and validates the API integration.

### Incremental Delivery
- Phase 3 (US1): Core portfolio analysis with performance and basic risk metrics
- Phase 4 (US2): Full correlation analysis (requires 2+ tickers)
- Phase 5 (US3): Enhanced results presentation and export

## Phase 1: Setup

No setup tasks required - using existing project infrastructure.

## Phase 2: Foundational

No foundational tasks required - reusing existing infrastructure (api.ts, prices.ts, formatToolResult).

## Phase 3: User Story 1 - Core Portfolio Analysis
**Goal**: Enable users to input multiple stock tickers and receive performance and risk analysis
**Priority**: P1
**Independent Test Criteria**: Tool accepts 1-20 tickers and returns structured performance/risk data for each valid ticker

### Implementation Tasks

- [x] T001 [US1] Create portfolio metrics utility module in src/utils/portfolio-metrics.ts with calculateReturns, calculateStandardDeviation, calculateMaxDrawdown, calculateSharpeRatio functions

- [x] T002 [US1] Create portfolio tool in src/tools/finance/portfolio.ts with DynamicStructuredTool, accepting tickers array and period parameter

- [x] T003 [US1] Implement parallel price fetching in portfolio.ts using existing get_prices tool for each ticker

- [x] T004 [US1] Implement performance metrics calculation: period return, ranking, relative to average in src/utils/portfolio-metrics.ts

- [x] T005 [US1] Implement risk metrics calculation: standard deviation, max drawdown, Sharpe ratio, risk classification in src/utils/portfolio-metrics.ts

- [x] T006 [US1] Add input validation for tickers (1-20, 1-5 uppercase letters) using Zod schema in src/tools/finance/portfolio.ts

- [x] T007 [US1] Handle invalid tickers gracefully with warning messages in output in src/tools/finance/portfolio.ts

- [x] T008 [US1] Export portfolio tool from src/tools/finance/index.ts

## Phase 4: User Story 2 - Correlation Analysis
**Goal**: Calculate and display correlation coefficients between all ticker pairs
**Priority**: P2
**Independent Test Criteria**: Correlation matrix returned for portfolios with 2+ valid tickers, single ticker returns note about no correlation data

### Implementation Tasks

- [x] T009 [P] [US2] Implement Pearson correlation coefficient calculation in src/utils/portfolio-metrics.ts

- [x] T010 [P] [US2] Implement correlation matrix builder in src/utils/portfolio-metrics.ts

- [x] T011 [US2] Add highly correlated (>0.7) and negatively correlated (<-0.3) asset detection in src/utils/portfolio-metrics.ts

- [x] T012 [US2] Integrate correlation analysis into portfolio tool in src/tools/finance/portfolio.ts

- [x] T013 [US2] Handle single-ticker edge case with appropriate message in src/tools/finance/portfolio.ts

## Phase 5: User Story 3 - Enhanced Results Presentation
**Goal**: Present results in structured, readable format with data source attribution
**Priority**: P3
**Independent Test Criteria**: Results include metadata, source URLs, and warnings for data quality issues

### Implementation Tasks

- [x] T014 [US3] Add analysis metadata (period, startDate, endDate, dataCoverage) to output in src/tools/finance/portfolio.ts

- [x] T015 [US3] Include source URLs from API responses in results in src/tools/finance/portfolio.ts

- [x] T016 [US3] Add data quality warnings for missing data points in src/tools/finance/portfolio.ts

- [x] T017 [US3] Implement concentration risk flagging based on correlation analysis in src/tools/finance/portfolio.ts

## Phase 6: Testing

- [x] T018 [US1] Create test file src/tools/finance/portfolio.test.ts with tests for metric calculations using known values

- [x] T019 [P] [US2] Add tests for correlation matrix generation in src/tools/finance/portfolio.test.ts

- [x] T020 [P] [US3] Add tests for edge cases: single ticker, invalid tickers, duplicate tickers in src/tools/finance/portfolio.test.ts

## Dependencies

```
Phase 3 (US1):
  T001 → T002 → T003 → T004 → T005 → T006 → T007 → T008

Phase 4 (US2):
  T009, T010 (parallel) → T011 → T012 → T013
  Note: Can parallel with Phase 3 after T005

Phase 5 (US3):
  T014, T015, T016 (parallel) → T017

Phase 6:
  T018 (depends on T008)
  T019 (depends on T012)
  T020 (depends on T017 or T008)
```

## Parallel Execution Opportunities

| Tasks | Reason |
|-------|--------|
| T009, T010 | Independent utility functions, no shared state |
| T014, T015, T016 | Independent metadata additions |
| T019, T020 | Independent test files |

## Summary

- **Total Tasks**: 20
- **Completed**: 16
- **User Story 1 (Core)**: 8 tasks ✅
- **User Story 2 (Correlation)**: 5 tasks ✅
- **User Story 3 (Presentation)**: 4 tasks ✅
- **Testing**: 3 tasks (1 completed, 2 remaining)
- **Parallelizable**: 6 tasks

## Quick Reference

| File | Tasks |
|------|-------|
| src/utils/portfolio-metrics.ts | T001, T004, T005, T009, T010, T011 ✅ |
| src/tools/finance/portfolio.ts | T002, T003, T006, T007, T008, T012, T013, T014, T015, T016, T017 ✅ |
| src/tools/finance/index.ts | T008 ✅ |
| src/tools/finance/portfolio.test.ts | T018 ✅ |
