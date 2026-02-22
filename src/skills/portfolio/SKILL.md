---
name: portfolio-analysis
description: Performs comparative portfolio analysis across multiple stock tickers. Calculates relative performance, risk metrics, and correlation coefficients. Use when user wants to compare stocks, analyze portfolio diversification, or assess risk/return characteristics.
---

# Portfolio Analysis Skill

## Workflow Checklist

Copy and track progress:
```
Portfolio Analysis Progress:
- [ ] Step 1: Validate tickers and set date range
- [ ] Step 2: Fetch historical price data for all tickers
- [ ] Step 3: Calculate daily returns for each ticker
- [ ] Step 4: Calculate relative performance metrics
- [ ] Step 5: Calculate risk metrics (volatility, Sharpe, max drawdown)
- [ ] Step 6: Calculate correlation matrix
- [ ] Step 7: Present comprehensive results
```

## Step 1: Validate Tickers and Set Date Range

### 1.1 Parse User Request

Extract the list of tickers from the user's request. Typical formats:
- "Compare AAPL, MSFT, GOOGL"
- "Analyze portfolio with NVDA, AMD, INTC"
- "Compare AAPL vs MSFT vs GOOGL"

Validate each ticker appears valid (typically 1-5 uppercase letters).

### 1.2 Determine Date Range

Default to **1 year** of historical data unless user specifies:
- "last 6 months" → 6 months
- "last 2 years" → 2 years
- "YTD" → Jan 1 of current year to today

## Step 2: Fetch Historical Price Data

For each ticker, call `get_prices` with:
- `ticker`: The stock ticker
- `interval`: "day"
- `start_date`: Calculated start date (YYYY-MM-DD)
- `end_date`: Today's date (YYYY-MM-DD)

**Example calls:**
```
get_prices(ticker="AAPL", interval="day", start_date="2025-02-21", end_date="2026-02-21")
get_prices(ticker="MSFT", interval="day", start_date="2025-02-21", end_date="2026-02-21")
```

**Extract from results:** Array of daily records with `close` prices.

**Note:** Ensure all tickers have the same date range. Handle missing data by interpolating or noting gaps.

## Step 3: Calculate Daily Returns

For each ticker, calculate daily returns:

```
daily_return_t = (price_t - price_{t-1}) / price_{t-1}
```

This creates a return series for each stock.

## Step 4: Calculate Relative Performance Metrics

### 4.1 Total Return

```
Total Return = (Final Price - Initial Price) / Initial Price × 100%
```

### 4.2 Annualized Return

```
Annualized Return = ((Final Price / Initial Price) ^ (252/trading_days)) - 1
```

Use 252 trading days per year.

### 4.3 Best and Worst Days

Find the single best and worst daily returns for each ticker over the period.

## Step 5: Calculate Risk Metrics

### 5.1 Volatility (Annualized Standard Deviation)

```
Volatility = Standard Deviation of Daily Returns × √252 × 100%
```

### 5.2 Sharpe Ratio

Assume risk-free rate of 4% (0.04) for the period:

```
Sharpe Ratio = (Annualized Return - 0.04) / Volatility
```

### 5.3 Maximum Drawdown

For each ticker:
1. Calculate cumulative return series from start
2. Track running maximum (peak)
3. Calculate drawdown at each point: (Peak - Current) / Peak
4. Maximum drawdown is the largest drawdown value

Express as percentage.

### 5.4 Sortino Ratio (Optional Enhancement)

Calculate using only downside volatility (negative returns only).

## Step 6: Calculate Correlation Matrix

For each pair of tickers, calculate Pearson correlation coefficient:

```
Correlation(A,B) = Σ((return_A - mean_A) × (return_B - mean_B)) /
                   √(Σ(return_A - mean_A)² × Σ(return_B - mean_B)²)
```

Build an N×N correlation matrix where N = number of tickers.

**Interpretation:**
- 1.0: Perfect positive correlation
- 0.0: No correlation
- -1.0: Perfect negative correlation

**Low correlation (<0.3)** indicates good diversification potential.

## Step 7: Present Comprehensive Results

### 7.1 Performance Summary Table

| Ticker | Total Return | Annualized Return | Best Day | Worst Day |
|--------|--------------|-------------------|----------|-----------|
| AAPL   | +XX.X%       | +XX.X%            | +X.X%    | -X.X%     |
| MSFT   | +XX.X%       | +XX.X%            | +X.X%    | -X.X%     |

### 7.2 Risk Metrics Table

| Ticker | Volatility | Sharpe Ratio | Max Drawdown |
|--------|------------|--------------|--------------|
| AAPL   | XX.X%      | X.XX         | -XX.X%       |
| MSFT   | XX.X%      | X.XX         | -XX.X%       |

### 7.3 Correlation Matrix

Present as a formatted table showing correlations between all pairs.

Highlight:
- High correlations (>0.7) - may reduce diversification benefit
- Negative correlations - good for diversification

### 7.4 Key Insights

Provide 2-3 actionable observations:
- Highest/lowest performer
- Highest/lowest risk (volatility)
- Best diversification pair (lowest correlation)
- Best risk-adjusted return (highest Sharpe ratio)

### 7.5 Caveats

- Past performance does not guarantee future results
- Correlation is historical and may change
- Transaction costs and taxes not considered
- Results based on close prices only (dividends excluded unless in returns)
