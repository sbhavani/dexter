# Portfolio Analysis Data Model

## Entities

### Portfolio
Represents a collection of stocks to analyze.

```typescript
interface Portfolio {
  tickers: StockTicker[];
  dateRange: DateRange;
  weighting: PortfolioWeighting;
}

interface DateRange {
  start: Date;
  end: Date;
}

type PortfolioWeighting =
  | { type: 'equal' }
  | { type: 'custom'; weights: number[] };
```

### StockTicker
A stock symbol with associated price data.

```typescript
interface StockTicker {
  symbol: string;          // e.g., "AAPL"
  name?: string;           // e.g., "Apple Inc."
  prices: PriceData[];     // Historical daily prices
  currentPrice?: number;   // Latest close price
}

interface PriceData {
  date: string;            // YYYY-MM-DD
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
  adjustedClose: number;  // Split/dividend adjusted
}
```

### PerformanceMetrics
Calculated performance data for a stock.

```typescript
interface PerformanceMetrics {
  ticker: string;
  totalReturn: number;           // Percentage return over period
  annualizedReturn: number;      // Annualized return
  dailyReturns: number[];        // Array of daily percentage returns
  ranking: number;               // Performance rank within portfolio
  contribution: number;          // Contribution to portfolio return
}
```

### RiskMetrics
Risk assessment metrics for a stock.

```typescript
interface RiskMetrics {
  ticker: string;
  volatility: number;             // Standard deviation of returns (annualized)
  sharpeRatio: number;           // Risk-adjusted return
  beta: number;                  // Beta relative to benchmark
}

interface PortfolioRiskMetrics {
  volatility: number;            // Portfolio-level volatility
  sharpeRatio: number;           // Portfolio-level Sharpe ratio
  valueAtRisk: number;           // VaR at specified confidence
  confidenceLevel: number;       // e.g., 0.95 for 95%
}
```

### CorrelationData
Pairwise correlation analysis between stocks.

```typescript
interface CorrelationData {
  tickers: string[];
  matrix: number[][];            // NxN correlation matrix
  highCorrelations: [string, string, number][];  // Pairs with corr > 0.7
  lowCorrelations: [string, string, number][];   // Pairs with corr < 0.3
}
```

---

## Validation Rules

### Portfolio Input
- Minimum 2 tickers required
- Maximum 50 tickers allowed
- Tickers must be valid (exist in market)

### Date Range
- Start date must be in the past
- End date must be today or in the past
- Minimum 30 days of data required for correlation/volatility
- Maximum range: 5 years

### Weights (if custom)
- Must sum to 1.0 (or 100%)
- Must have exactly one weight per ticker

### Calculations
- Returns calculated using adjusted close prices
- Volatility annualized using square root of days (252 trading days)
- Sharpe ratio uses 4.5% risk-free rate
- Beta calculated against S&P 500 (^GSPC)

---

## State Transitions

```
[Input] --> [Validating] --> [Fetching Data] --> [Calculating] --> [Output]
   |           |                  |                  |              |
   +-----------+------------------+------------------+--------------+
   |           |                  |                  |              |
 [Error:    [Error:         [Error:           [Error:         |
  Invalid    Insufficient    API            Calculation     |
  Tickers]   Data]           Failure]       Error]
```

---

## API Contracts

### GET /prices/
**Existing** - Fetches historical price data

**Request**:
```
ticker: string
interval: 'day'
start_date: YYYY-MM-DD
end_date: YYYY-MM-DD
```

**Response**:
```typescript
{
  prices: PriceData[];
  url: string;
}
```

---

## CLI Commands

### `portfolio` Command

**Usage**: `dexter portfolio <tickers...> [flags]`

**Arguments**:
- `tickers` - One or more stock symbols (space/comma separated)

**Flags**:
| Flag | Type | Default | Description |
|------|------|---------|-------------|
| `-p, --period` | string | "1y" | Time period (1m, 3m, 6m, 1y, ytd) |
| `--json` | boolean | false | JSON output |
| `--benchmark` | string | "^GSPC" | Benchmark ticker |
| `--weights` | string | equal | Comma-separated weights |
| `--export` | string | none | Export format (csv, pdf) |
| `-h, --help` | boolean | false | Help |

---

## Output Formats

### Human-Readable
```
Portfolio Analysis: [AAPL, GOOGL, MSFT]
Period: 1 Year (2025-02-22 to 2026-02-22)

Performance Ranking:
1. AAPL  +42.3%
2. MSFT  +38.1%
3. GOOGL +22.5%

Risk Metrics:
        Volatility  Sharpe  Beta
AAPL    28.5%       1.42    1.23
GOOGL   24.2%       1.18    1.05
MSFT    22.8%       1.55    0.98

Correlation Matrix:
       AAPL   GOOGL  MSFT
AAPL   1.00   0.72   0.65
GOOGL  0.72   1.00   0.58
MSFT   0.65   0.58   1.00
```

### JSON
```json
{
  "portfolio": {
    "tickers": ["AAPL", "GOOGL", "MSFT"],
    "dateRange": { "start": "2025-02-22", "end": "2026-02-22" },
    "period": "1y"
  },
  "performance": [
    { "ticker": "AAPL", "totalReturn": 42.3, "annualizedReturn": 42.3, "ranking": 1 },
    { "ticker": "MSFT", "totalReturn": 38.1, "annualizedReturn": 38.1, "ranking": 2 },
    { "ticker": "GOOGL", "totalReturn": 22.5, "annualizedReturn": 22.5, "ranking": 3 }
  ],
  "risk": [
    { "ticker": "AAPL", "volatility": 28.5, "sharpeRatio": 1.42, "beta": 1.23 },
    { "ticker": "GOOGL", "volatility": 24.2, "sharpeRatio": 1.18, "beta": 1.05 },
    { "ticker": "MSFT", "volatility": 22.8, "sharpeRatio": 1.55, "beta": 0.98 }
  ],
  "portfolioRisk": {
    "volatility": 24.8,
    "sharpeRatio": 1.35,
    "valueAtRisk": 3.2,
    "confidenceLevel": 0.95
  },
  "correlation": {
    "tickers": ["AAPL", "GOOGL", "MSFT"],
    "matrix": [
      [1.00, 0.72, 0.65],
      [0.72, 1.00, 0.58],
      [0.65, 0.58, 1.00]
    ]
  }
}
```
