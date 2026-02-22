---
name: portfolio-analysis
description: Performs comparative portfolio analysis across multiple stock tickers including relative performance, risk metrics, and correlation coefficients. Triggers when user wants to compare multiple stocks, analyze portfolio diversification, calculate correlation between assets, or assess risk-adjusted returns.
---

# Portfolio Analysis Skill

## Workflow Checklist

Copy and track progress:
```
Portfolio Analysis Progress:
- [ ] Step 1: Gather price data for all tickers
- [ ] Step 2: Calculate relative performance metrics
- [ ] Step 3: Calculate risk metrics
- [ ] Step 4: Calculate correlation coefficients
- [ ] Step 5: Generate comparative visualizations (text-based)
- [ ] Step 6: Present comprehensive results
```

## Step 1: Gather Price Data

Use the `portfolio_analysis` tool to fetch historical price data for all requested tickers.

**Required inputs:**
- `tickers`: Array of stock ticker symbols (e.g., ["AAPL", "MSFT", "GOOGL"])
- `start_date`: Start date in YYYY-MM-DD format (recommend at least 1 year of data)
- `end_date`: End date in YYYY-MM-DD format (use today or most recent trading day)

**Recommendation:** Use at least 1 year of daily data for meaningful correlation analysis. For more robust statistics, use 2-3 years.

## Step 2: Calculate Relative Performance

From the portfolio_analysis tool output, extract and present:

### Total Return
- Calculate percentage change from start to end price for each ticker
- Present as a ranked table

### Annualized Return (CAGR)
- Formula: `(End Value / Start Value)^(252/days) - 1`
- Compare across all tickers

### Period-by-Period Performance
- Year-to-date (YTD)
- 1-month, 3-month, 6-month
- 1-year

## Step 3: Calculate Risk Metrics

Present the following risk metrics from the portfolio_analysis tool:

### Volatility (Annualized Standard Deviation)
- Measure of price fluctuation
- Higher = more risk
- Formula: `Daily Std Dev * sqrt(252)`

### Maximum Drawdown
- Largest peak-to-trough decline
- Critical for understanding worst-case scenarios

### Sharpe Ratio
- Risk-adjusted return metric
- Formula: `(Annualized Return - Risk-Free Rate) / Annualized Volatility`
- Use 4% as default risk-free rate
- Interpretation:
  - > 1.0: Good risk-adjusted return
  - > 2.0: Excellent
  - < 0: Poor (return less than risk-free)

### Sortino Ratio
- Similar to Sharpe but only considers downside volatility
- Better for asymmetric return distributions

### Beta (if benchmark data available)
- Measure of systematic risk relative to market
- > 1.0: More volatile than market
- < 1.0: Less volatile than market

## Step 4: Calculate Correlation Coefficients

Present the correlation matrix from portfolio_analysis:

### Correlation Matrix Interpretation
- **+1.0**: Perfect positive correlation (move together)
- **0.0**: No correlation (independent)
- **-1.0**: Perfect negative correlation (move opposite)

### Portfolio Implications
- **Low correlation (< 0.3)**: Good diversification - assets don't move together
- **Moderate correlation (0.3-0.7)**: Some diversification benefit
- **High correlation (> 0.7)**: Poor diversification - assets move together

**Identify diversification opportunities:** Flag pairs with low/negative correlation that could improve portfolio diversification.

## Step 5: Generate Comparative Visualizations

Create text-based visualizations:

### Performance Chart (ASCII)
```
AAPL:    ████████████████████████████░░░░░░░░  +45.2%
MSFT:    ██████████████████████████░░░░░░░░░░  +38.7%
GOOGL:   ████████████████████░░░░░░░░░░░░░░░  +28.1%
AMZN:    █████████████████░░░░░░░░░░░░░░░░░░  +22.4%
TSLA:    ████████░░░░░░░░░░░░░░░░░░░░░░░░░░   +8.1%
```

### Risk-Return Scatter (Text)
Plot risk (volatility) vs return for each ticker to identify efficient frontier candidates.

## Step 6: Output Format

Present a comprehensive summary including:

### Executive Summary
- Top performer by total return
- Lowest risk (volatility) ticker
- Best risk-adjusted return (Sharpe ratio)
- Best/worst diversification pairs

### Detailed Metrics Table
| Ticker | Total Return | CAGR | Volatility | Max Drawdown | Sharpe |
|--------|-------------|------|------------|--------------|--------|
| AAPL   | +45.2%      | 42%  | 28%        | -12%         | 1.36   |
| ...    | ...         | ...  | ...        | ...          | ...    |

### Correlation Matrix
Show pairwise correlations in a matrix format.

### Key Insights
- 3-5 actionable insights based on the analysis
- Diversification recommendations
- Risk warnings if any ticker has unusually high risk

### Caveats
- Past performance doesn't guarantee future results
- Correlation is not causation
- Market conditions can change correlations over time
