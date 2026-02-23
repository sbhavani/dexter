# Portfolio Analysis API Contracts

## CLI Contract

### Command: `portfolio`

```yaml
command: portfolio
description: Analyze multiple stock tickers as a portfolio
arguments:
  - name: tickers
    type: string[]
    description: Stock ticker symbols (space or comma separated)
    required: true
    minItems: 2
    maxItems: 50

flags:
  - name: period
    short: p
    type: string
    default: "1y"
    description: Time period for analysis
    enum: [1m, 3m, 6m, 1y, ytd, custom]

  - name: json
    type: boolean
    default: false
    description: Output results as JSON

  - name: benchmark
    type: string
    default: "^GSPC"
    description: Benchmark ticker for beta calculation

  - name: weights
    type: string
    description: Comma-separated portfolio weights (must sum to 1)

  - name: export
    type: string
    description: Export format
    enum: [csv, pdf]

  - name: help
    short: h
    type: boolean
    default: false
    description: Show help
```

## Input Schema

### PortfolioInput
```typescript
{
  tickers: string[],           // ["AAPL", "GOOGL", "MSFT"]
  period: "1m" | "3m" | "6m" | "1y" | "ytd" | "custom",
  startDate?: string,          // YYYY-MM-DD (if custom)
  endDate?: string,            // YYYY-MM-DD (if custom)
  benchmark?: string,          // default: "^GSPC"
  weights?: number[],          // optional, default: equal weight
}
```

## Output Schema

### PortfolioAnalysis
```typescript
{
  // Portfolio info
  portfolio: {
    tickers: string[],
    dateRange: {
      start: string,  // YYYY-MM-DD
      end: string     // YYYY-MM-DD
    },
    period: string,
    weighting: "equal" | "custom",
    weights?: number[]
  },

  // Performance results
  performance: {
    ticker: string,
    totalReturn: number,           // percentage
    annualizedReturn: number,       // percentage
    dailyReturns: number[],
    ranking: number,
    contribution: number            // percentage
  }[],

  // Individual risk metrics
  risk: {
    ticker: string,
    volatility: number,             // percentage (annualized)
    sharpeRatio: number,
    beta: number
  }[],

  // Portfolio-level risk
  portfolioRisk: {
    volatility: number,
    sharpeRatio: number,
    valueAtRisk: number,
    confidenceLevel: number
  },

  // Correlation analysis
  correlation: {
    tickers: string[],
    matrix: number[][],             // NxN matrix
    highCorrelations: [string, string, number][],
    lowCorrelations: [string, string, number][]
  },

  // Metadata
  metadata: {
    calculatedAt: string,          // ISO timestamp
    dataPoints: number,             // days of data used
    riskFreeRate: number
  }
}
```

## Error Schemas

### ValidationError
```typescript
{
  error: "VALIDATION_ERROR",
  message: string,
  invalidTickers?: string[],
  issues?: { field: string, message: string }[]
}
```

### InsufficientDataError
```typescript
{
  error: "INSUFFICIENT_DATA",
  message: string,
  availableDays: number,
  requiredDays: number
}
```

### ApiError
```typescript
{
  error: "API_ERROR",
  message: string,
  retryAfter?: number
}
```
