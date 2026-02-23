/**
 * Portfolio Analysis Types
 * TypeScript interfaces for portfolio analysis feature
 */

// Price data from API
export interface PriceData {
  date: string;          // YYYY-MM-DD
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
  adjustedClose: number; // Split/dividend adjusted
}

// Stock ticker with price data
export interface StockTicker {
  symbol: string;
  name?: string;
  prices: PriceData[];
  currentPrice?: number;
}

// Portfolio configuration
export interface Portfolio {
  tickers: string[];
  dateRange: DateRange;
  weighting: PortfolioWeighting;
}

export interface DateRange {
  start: string;  // YYYY-MM-DD
  end: string;   // YYYY-MM-DD
}

export type PortfolioWeighting =
  | { type: 'equal' }
  | { type: 'custom'; weights: number[] };

// Performance metrics
export interface PerformanceMetrics {
  ticker: string;
  totalReturn: number;           // Percentage return over period
  annualizedReturn: number;       // Annualized return
  dailyReturns: number[];        // Array of daily percentage returns
  ranking: number;               // Performance rank within portfolio
  contribution: number;          // Contribution to portfolio return
}

// Risk metrics for individual stock
export interface RiskMetrics {
  ticker: string;
  volatility: number;             // Standard deviation (annualized %)
  sharpeRatio: number;            // Risk-adjusted return
  beta: number;                  // Beta relative to benchmark
}

// Portfolio-level risk metrics
export interface PortfolioRiskMetrics {
  volatility: number;             // Portfolio-level volatility
  sharpeRatio: number;           // Portfolio-level Sharpe ratio
  valueAtRisk: number;           // VaR at specified confidence
  confidenceLevel: number;       // e.g., 0.95 for 95%
}

// Correlation data
export interface CorrelationData {
  tickers: string[];
  matrix: number[][];                          // NxN correlation matrix
  highCorrelations: [string, string, number][]; // Pairs with corr > 0.7
  lowCorrelations: [string, string, number][];  // Pairs with corr < 0.3
}

// Complete portfolio analysis result
export interface PortfolioAnalysis {
  portfolio: {
    tickers: string[];
    dateRange: DateRange;
    period: string;
    weighting: string;
    weights?: number[];
  };
  performance: PerformanceMetrics[];
  risk: RiskMetrics[];
  portfolioRisk: PortfolioRiskMetrics;
  correlation: CorrelationData;
  metadata: {
    calculatedAt: string;
    dataPoints: number;
    riskFreeRate: number;
  };
}

// CLI input options
export interface PortfolioCLIOptions {
  tickers: string[];
  period: '1m' | '3m' | '6m' | '1y' | 'ytd' | 'custom';
  startDate?: string;
  endDate?: string;
  benchmark: string;
  weights?: number[];
  json: boolean;
  export?: 'csv' | 'pdf';
}

// Validation error
export interface ValidationError {
  error: 'VALIDATION_ERROR';
  message: string;
  invalidTickers?: string[];
  issues?: { field: string; message: string }[];
}

// API error
export interface APIError {
  error: 'API_ERROR';
  message: string;
  retryAfter?: number;
}
