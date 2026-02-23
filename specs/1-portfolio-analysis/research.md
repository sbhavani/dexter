# Portfolio Analysis Research

## Overview
This document captures research findings for the portfolio analysis feature. No NEEDS CLARIFICATION markers existed in the spec, so this research confirms existing project infrastructure can support the feature.

---

## Technical Context Analysis

### Existing Infrastructure

#### Financial Data Tools
The project already contains robust financial data tooling in `src/tools/finance/`:

| Tool | Purpose | Reusable |
|------|---------|----------|
| `prices.ts` | Historical OHLCV data | YES - core data source |
| `api.ts` | API caller with caching | YES - rate limiting built-in |
| `financial-metrics.ts` | Financial metric calculations | PARTIAL - may extend |

#### Price Data Endpoint
The existing `/prices/` API provides:
- Historical daily prices with OHLCV data
- Adjusted close prices (splits/dividends handled)
- Configurable date ranges
- Interval support (minute, day, week, month)

**Decision**: Use existing `get_prices` tool as the primary data source.

#### Rate Limiting
The existing API caller already implements caching and rate limiting.

**Decision**: Leverage existing rate limiting, add queue for bulk ticker requests.

---

## Financial Calculation Standards

### Formulas Used

#### Total Return
```
Total Return = (End Price - Start Price) / Start Price × 100
```

#### Annualized Return
```
Annualized Return = ((1 + Total Return) ^ (252 / Days)) - 1
```

#### Volatility (Annualized)
```
Volatility = Standard Deviation(Daily Returns) × √252 × 100
```

#### Sharpe Ratio
```
Sharpe Ratio = (Annualized Return - Risk-Free Rate) / Volatility
```
- Risk-free rate: 4.5% (configurable)

#### Beta
```
Beta = Covariance(Stock Returns, Benchmark Returns) / Variance(Benchmark Returns)
```

#### Pearson Correlation
```
Correlation = Covariance(X, Y) / (StdDev(X) × StdDev(Y))
```

#### Value at Risk (Parametric)
```
VaR = Portfolio Value × (Mean Return - Z × StdDev)
```
- Z = 1.65 for 95% confidence

---

## Technology Decisions

### Framework: LangChain + Existing Tools
- Use LangChain `DynamicStructuredTool` pattern from existing code
- Extend `src/tools/finance/index.ts` with new portfolio tools
- No additional dependencies required

### Data Validation: Zod
- Already in project dependencies (`zod`: ^4.1.13)
- Use for input validation schemas

### Testing: Bun Test
- Already configured in project
- Use for unit tests of calculation functions

---

## Alternatives Considered

### Option 1: External Portfolio API
**Considered**: Use dedicated portfolio analysis API
**Verdict**: REJECTED - Existing price data is sufficient, adds unnecessary dependency

### Option 2: Real-time Data
**Considered**: Intraday streaming prices
**Verdict**: OUT OF SCOPE - Per spec, end-of-day only

### Option 3: Multiple Data Sources
**Considered**: Aggregate from multiple financial APIs
**Verdict**: REJECTED - Single source (Financial Datasets) is sufficient and simpler

---

## Project Structure Implications

### New Files Required

```
src/
├── tools/
│   └── finance/
│       ├── portfolio.ts         # NEW - Portfolio analysis tools
│       └── index.ts              # MODIFY - Export portfolio tools
├── portfolio/                    # NEW - Portfolio calculation services
│   ├── index.ts
│   ├── performance.ts           # Return calculations
│   ├── risk.ts                  # Risk metric calculations
│   └── correlation.ts           # Correlation calculations
├── cli/                          # MODIFY - Add portfolio commands
│   └── portfolio.ts             # NEW - Portfolio CLI handler
```

### Modification to Existing Files

1. `src/tools/finance/index.ts` - Add portfolio exports
2. `src/cli.ts` - Add portfolio command
3. New test files in `src/` following existing patterns

---

## Conclusion

The existing project infrastructure is well-suited for portfolio analysis:

1. ✅ Price data available via existing `/prices/` API
2. ✅ Rate limiting and caching built into API layer
3. ✅ Zod for validation
4. ✅ Bun test for testing
5. ✅ LangChain tool pattern established

No blockers identified. Implementation can proceed with existing tools.
