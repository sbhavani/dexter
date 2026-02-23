# Portfolio Analysis Tasks

**Feature**: Portfolio Analysis
**Branch**: 1-portfolio-analysis
**Spec**: specs/1-portfolio-analysis/spec.md
**Plan**: specs/1-portfolio-analysis/plan.md

---

## Phase 1: Setup

Setup tasks to initialize the portfolio analysis feature.

- [X] T001 Create portfolio module directory structure `src/portfolio/`
- [X] T002 Add portfolio exports to `src/tools/finance/index.ts`

---

## Phase 2: Foundational

Core infrastructure required before implementing user stories.

- [X] T003 Define TypeScript interfaces for Portfolio, StockTicker, PriceData in `src/portfolio/types.ts`
- [X] T004 Define PerformanceMetrics and RiskMetrics interfaces in `src/portfolio/types.ts`
- [X] T005 Define CorrelationData interface in `src/portfolio/types.ts`
- [X] T006 Create Zod validation schema for PortfolioInput in `src/portfolio/validation.ts`
- [X] T007 Implement ticker list parser (comma/space/newline separated) in `src/portfolio/parser.ts`
- [X] T008 Create price data aggregation service in `src/portfolio/data-service.ts`

---

## Phase 3: User Story 1 - Basic Portfolio Analysis (P1)

**Goal**: Users can input multiple stock tickers and receive comparative performance metrics

**Independent Test Criteria**: `bun start portfolio AAPL GOOGL MSFT --period 1y` displays performance table with returns for all tickers

### Implementation Tasks

- [X] T009 [P] [US1] Implement daily returns calculation in `src/portfolio/calculations/returns.ts`
- [X] T010 [P] [US1] Implement total return calculation in `src/portfolio/calculations/returns.ts`
- [X] T011 [P] [US1] Implement annualized return calculation in `src/portfolio/calculations/returns.ts`
- [X] T012 [US1] Implement performance ranking logic in `src/portfolio/calculations/returns.ts`
- [X] T013 [US1] Create portfolio performance service in `src/portfolio/services/performance.ts`
- [X] T014 [US1] Create analyzePortfolio function in `src/portfolio/index.ts`

---

## Phase 4: User Story 2 - Relative Performance Comparison (P1)

**Goal**: Display each stock's performance relative to other portfolio members and benchmark

**Independent Test Criteria**: Output shows ranking and relative comparison between all portfolio stocks

### Implementation Tasks

- [X] T015 [P] [US2] Implement benchmark data fetching (S&P 500) in `src/portfolio/data-service.ts`
- [X] T016 [US2] Calculate relative performance vs benchmark in `src/portfolio/services/performance.ts`
- [X] T017 [US2] Add contribution to portfolio return calculation in `src/portfolio/services/performance.ts`
- [X] T018 [US2] Display performance ranking in output in `src/portfolio/formatters/table.ts`

---

## Phase 5: User Story 3 - Risk Assessment (P2)

**Goal**: Calculate and display risk metrics (volatility, Sharpe ratio, beta, VaR) for each stock and portfolio

**Independent Test Criteria**: Output includes volatility, Sharpe ratio, and beta for each ticker plus portfolio-level risk

### Implementation Tasks

- [X] T019 [P] [US3] Implement volatility calculation (standard deviation) in `src/portfolio/calculations/risk.ts`
- [X] T020 [P] [US3] Implement Sharpe ratio calculation in `src/portfolio/calculations/risk.ts`
- [X] T021 [P] [US3] Implement beta calculation against benchmark in `src/portfolio/calculations/risk.ts`
- [X] T022 [US3] Implement Value at Risk (VaR) calculation in `src/portfolio/calculations/risk.ts`
- [X] T023 [US3] Implement portfolio-level risk aggregation in `src/portfolio/services/risk.ts`
- [X] T024 [US3] Add risk metrics to output in `src/portfolio/formatters/table.ts`

---

## Phase 6: User Story 4 - Correlation Analysis (P2)

**Goal**: Display pairwise correlation coefficients between all stocks in portfolio

**Independent Test Criteria**: Correlation matrix shows all ticker pairs with correlation coefficients

### Implementation Tasks

- [X] T025 [P] [US4] Implement Pearson correlation coefficient calculation in `src/portfolio/calculations/correlation.ts`
- [X] T026 [P] [US4] Build correlation matrix for all ticker pairs in `src/portfolio/calculations/correlation.ts`
- [X] T027 [US4] Identify high correlation pairs (>0.7) in `src/portfolio/services/correlation.ts`
- [X] T028 [US4] Identify low/negative correlation pairs (<0.3) in `src/portfolio/services/correlation.ts`
- [X] T029 [US4] Display correlation matrix in output in `src/portfolio/formatters/table.ts`

---

## Phase 7: CLI Integration

Integrate portfolio analysis into the CLI with commands and output formatting.

- [X] T030 Add portfolio command to CLI in `src/cli.ts`
- [X] T031 Implement period flag parsing (1m, 3m, 6m, 1y, ytd) in `src/portfolio/cli.ts`
- [X] T032 Implement JSON output flag in `src/portfolio/formatters/json.ts`
- [X] T033 Implement human-readable table output in `src/portfolio/formatters/table.ts`
- [X] T034 Implement benchmark flag in `src/portfolio/cli.ts`
- [X] T035 Implement weights flag for custom portfolio weighting in `src/portfolio/cli.ts`

---

## Phase 8: Error Handling & Polish

Edge cases and user experience improvements.

- [X] T036 Handle invalid tickers with clear error messages in `src/portfolio/validation.ts`
- [X] T037 Handle insufficient data warning (less than 30 days) in `src/portfolio/data-service.ts`
- [X] T038 Handle single ticker edge case in `src/portfolio/validation.ts`
- [X] T039 Add retry logic for API failures in `src/portfolio/data-service.ts`
- [X] T040 Add help text for portfolio command in `src/portfolio/cli.ts`

---

## Dependencies Graph

```
Phase 2 (Foundational)
    │
    ├── T003-T005: Type definitions
    ├── T006: Validation schema
    ├── T007: Parser
    └── T008: Data service
         │
         ▼
Phase 3 (US1) ◄──── T009-T011 parallel
    │              T012-T014 sequential
    │
    ├── T015-T016 (US2 depends on US1 data)
    └── T019-T021 (US3 can be parallel)
         │
         ▼
Phase 5 (US3) ◄──── T019-T021 parallel
    │              T022-T025 sequential
    │
    ▼
Phase 6 (US4) ◄──── T025-T026 parallel
                   T027-T029 sequential

Phase 7 (CLI) ◄── All prior phases complete
    │
    ▼
Phase 8 (Polish)
```

---

## Parallel Execution Opportunities

| Tasks | Reason | Can Run In Parallel |
|-------|--------|---------------------|
| T009-T011 | Different return calculations, same input | Yes |
| T019-T021 | Different risk calculations, same input | Yes |
| T025-T026 | Correlation matrix calculations | Yes |
| T015, T019 | Both need data service but different calcs | Yes |

---

## Implementation Strategy

### MVP Scope (User Stories 1 & 2)
- Phase 1-4: Basic portfolio input and performance analysis
- Target: `bun start portfolio AAPL GOOGL MSFT --period 1y` works
- Deliverable: Core portfolio performance comparison

### Incremental Delivery
1. **Sprint 1**: Phases 1-4 (Performance analysis MVP)
2. **Sprint 2**: Phase 5 (Risk metrics)
3. **Sprint 3**: Phase 6 (Correlation analysis)
4. **Sprint 4**: Phases 7-8 (CLI polish, export, visualization)

---

## Summary

- **Total Tasks**: 40
- **Completed**: 40
- **User Story 1**: 5 tasks
- **User Story 2**: 4 tasks
- **User Story 3**: 6 tasks
- **User Story 4**: 5 tasks
- **Setup/Foundational**: 8 tasks
- **CLI Integration**: 6 tasks
- **Polish**: 6 tasks

- **Parallelizable Tasks**: 9
- **Suggested MVP**: Phase 3 (US1) - first deliverable in ~3 days
