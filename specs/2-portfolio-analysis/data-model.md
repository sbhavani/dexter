# Portfolio Analysis Data Model

## Entities

### PortfolioAnalysisInput
User input for portfolio analysis.

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| tickers | string[] | Yes | List of 1-20 stock ticker symbols |
| period | number | No | Analysis period in days (default: 30) |

**Validation**:
- Each ticker: 1-5 uppercase letters (regex: `^[A-Z]{1,5}$`)
- Array length: 1-20 tickers

### TickerResult
Analysis result for a single ticker.

| Field | Type | Description |
|-------|------|-------------|
| symbol | string | Ticker symbol |
| name | string | Company name (if available) |
| valid | boolean | Whether ticker has valid data |

### PerformanceMetrics
Performance data for a single ticker.

| Field | Type | Description |
|-------|------|-------------|
| periodReturn | number | Percentage return over period |
| ranking | number | Performance rank (1 = best) |
| relativeToAverage | number | Return relative to portfolio average |

### RiskMetrics
Risk assessment for a single ticker.

| Field | Type | Description |
|-------|------|-------------|
| standardDeviation | number | Standard deviation of daily returns |
| maxDrawdown | number | Maximum peak-to-trough decline (%) |
| sharpeRatio | number | Sharpe ratio (annualized) |
| riskClassification | "low" \| "medium" \| "high" | Risk level based on volatility |

**Risk Classification Thresholds**:
- Low: standardDeviation < 15
- Medium: 15 <= standardDeviation < 30
- High: standardDeviation >= 30

### CorrelationEntry
Correlation between two tickers.

| Field | Type | Description |
|-------|------|-------------|
| ticker1 | string | First ticker symbol |
| ticker2 | string | Second ticker symbol |
| coefficient | number | Pearson correlation (-1 to +1) |
| classification | "positive" \| "negative" \| "neutral" | Correlation type |

**Classification Thresholds**:
- Positive: coefficient > 0.3
- Negative: coefficient < -0.3
- Neutral: -0.3 <= coefficient <= 0.3

### CorrelationMatrix
Full correlation analysis.

| Field | Type | Description |
|-------|------|-------------|
| entries | CorrelationEntry[] | All ticker pair correlations |
| highlyCorrelated | CorrelationEntry[] | Pairs with coefficient > 0.7 |
| negativelyCorrelated | CorrelationEntry[] | Pairs with coefficient < -0.3 |

### PortfolioAnalysisResult
Complete portfolio analysis output.

| Field | Type | Description |
|-------|------|-------------|
| tickers | TickerResult[] | Processed tickers with validity |
| performance | PerformanceMetrics[] | Performance metrics per ticker |
| risk | RiskMetrics[] | Risk metrics per ticker |
| correlation | CorrelationMatrix | Full correlation analysis |
| metadata | AnalysisMetadata | Analysis context |

### AnalysisMetadata
Context information about the analysis.

| Field | Type | Description |
|-------|------|-------------|
| period | number | Days analyzed |
| startDate | string | Analysis start date (YYYY-MM-DD) |
| endDate | string | Analysis end date (YYYY-MM-DD) |
| dataCoverage | number | Percentage of requested period covered |
| warnings | string[] | Any data quality warnings |
| sourceUrls | string[] | Data source references |

## State Transitions

```
Input → Validate → Fetch Prices → Calculate Metrics → Format Result
         ↓
      Invalid → Return Error with details
```

## Acceptance Criteria for Data Model

1. All numeric fields use consistent precision (2 decimal places for percentages)
2. Correlation coefficients bounded to [-1, +1]
3. Timestamps in ISO 8601 format
4. All arrays preserve order of input tickers
5. Deduplicated tickers in output (first occurrence wins)
