# Portfolio Analysis Quickstart

## Overview

The Portfolio Analysis tool enables comparative analysis of multiple stock tickers, providing relative performance rankings, risk metrics, and correlation coefficients.

## Usage

### Basic Analysis

Analyze a portfolio of stocks:

```typescript
import { createPortfolioAnalysis } from './tools/finance/portfolio.js';

const portfolioTool = createPortfolioAnalysis('claude-sonnet-4-20250514');

const result = await portfolioTool.invoke({
  tickers: ['AAPL', 'GOOGL', 'MSFT', 'TSLA'],
  period: 30
});
```

### Parameters

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| tickers | string[] | Yes | List of 1-20 stock symbols |
| period | number | No | Days to analyze (default: 30) |

Valid periods: 30, 60, 90, 180

### Example Output

```json
{
  "data": {
    "tickers": [
      { "symbol": "AAPL", "name": "Apple Inc.", "valid": true },
      { "symbol": "GOOGL", "name": "Alphabet Inc.", "valid": true },
      { "symbol": "MSFT", "name": "Microsoft Corporation", "valid": true },
      { "symbol": "TSLA", "name": "Tesla, Inc.", "valid": true }
    ],
    "performance": [
      { "symbol": "AAPL", "periodReturn": 5.2, "ranking": 2, "relativeToAverage": 1.1 },
      { "symbol": "GOOGL", "periodReturn": 3.8, "ranking": 3, "relativeToAverage": -0.3 },
      { "symbol": "MSFT", "periodReturn": 6.5, "ranking": 1, "relativeToAverage": 2.4 },
      { "symbol": "TSLA", "periodReturn": -1.2, "ranking": 4, "relativeToAverage": -5.3 }
    ],
    "risk": [
      { "symbol": "AAPL", "standardDeviation": 12.3, "maxDrawdown": -4.2, "sharpeRatio": 1.8, "riskClassification": "low" },
      { "symbol": "GOOGL", "standardDeviation": 14.1, "maxDrawdown": -5.8, "sharpeRatio": 1.2, "riskClassification": "low" },
      { "symbol": "MSFT", "standardDeviation": 11.8, "maxDrawdown": -3.9, "sharpeRatio": 2.1, "riskClassification": "low" },
      { "symbol": "TSLA", "standardDeviation": 32.5, "maxDrawdown": -12.4, "sharpeRatio": 0.4, "riskClassification": "high" }
    ],
    "correlation": {
      "entries": [
        { "ticker1": "AAPL", "ticker2": "GOOGL", "coefficient": 0.72, "classification": "positive" },
        { "ticker1": "AAPL", "ticker2": "MSFT", "coefficient": 0.68, "classification": "positive" },
        { "ticker1": "AAPL", "ticker2": "TSLA", "coefficient": 0.34, "classification": "positive" },
        { "ticker1": "GOOGL", "ticker2": "MSFT", "coefficient": 0.75, "classification": "positive" },
        { "ticker1": "GOOGL", "ticker2": "TSLA", "coefficient": 0.28, "classification": "neutral" },
        { "ticker1": "MSFT", "ticker2": "TSLA", "coefficient": 0.31, "classification": "positive" }
      ],
      "highlyCorrelated": [
        { "ticker1": "GOOGL", "ticker2": "MSFT", "coefficient": 0.75 }
      ],
      "negativelyCorrelated": []
    },
    "metadata": {
      "period": 30,
      "startDate": "2026-01-23",
      "endDate": "2026-02-22",
      "dataCoverage": 100,
      "warnings": [],
      "sourceUrls": ["https://api.financialdatasets.ai/prices/"]
    }
  }
}
```

## Error Handling

### Invalid Ticker

```json
{
  "data": {
    "tickers": [
      { "symbol": "AAPL", "valid": true },
      { "symbol": "INVALID", "valid": false }
    ],
    "warnings": ["Ticker INVALID not found or delisted"]
  }
}
```

### Single Ticker

When only one ticker is provided, correlation analysis is skipped with a note.

## Integration

### With Agents

```typescript
const portfolioTool = createPortfolioAnalysis(model);

const agent = new Agent({
  tools: [portfolioTool],
  // ... other config
});
```

### With CLI

The tool can be invoked via the existing CLI infrastructure by adding it to the tool registry.
