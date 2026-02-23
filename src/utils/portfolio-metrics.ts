/**
 * Portfolio Analysis Metrics Utility Module
 *
 * Provides financial calculation functions for portfolio analysis including:
 * - Returns calculation
 * - Risk metrics (standard deviation, max drawdown, Sharpe ratio)
 * - Correlation analysis
 */

export interface PriceData {
  date: string;
  close: number;
  open?: number;
  high?: number;
  low?: number;
  volume?: number;
}

export interface ReturnsData {
  daily: number[];
  period: number;
}

export interface PerformanceMetrics {
  symbol: string;
  periodReturn: number;
  ranking: number;
  relativeToAverage: number;
}

export interface RiskMetrics {
  symbol: string;
  standardDeviation: number;
  maxDrawdown: number;
  sharpeRatio: number;
  riskClassification: 'low' | 'medium' | 'high';
}

export interface CorrelationEntry {
  ticker1: string;
  ticker2: string;
  coefficient: number;
  classification: 'positive' | 'negative' | 'neutral';
}

export interface CorrelationMatrix {
  entries: CorrelationEntry[];
  highlyCorrelated: CorrelationEntry[];
  negativelyCorrelated: CorrelationEntry[];
}

const RISK_FREE_RATE = 0.04; // 4% annual risk-free rate
const TRADING_DAYS_PER_YEAR = 252;

/**
 * Calculate daily returns from price data
 * @param prices - Array of price data sorted by date (oldest first)
 * @returns Array of daily returns (as decimals, not percentages)
 */
export function calculateReturns(prices: PriceData[]): number[] {
  if (prices.length < 2) {
    return [];
  }

  const returns: number[] = [];
  for (let i = 1; i < prices.length; i++) {
    const previousClose = prices[i - 1].close;
    const currentClose = prices[i].close;
    if (previousClose !== 0) {
      returns.push((currentClose - previousClose) / previousClose);
    }
  }
  return returns;
}

/**
 * Calculate period return from price data
 * @param prices - Array of price data
 * @returns Period return as percentage
 */
export function calculatePeriodReturn(prices: PriceData[]): number {
  if (prices.length < 2) {
    return 0;
  }
  const startPrice = prices[0].close;
  const endPrice = prices[prices.length - 1].close;
  if (startPrice === 0) {
    return 0;
  }
  return ((endPrice - startPrice) / startPrice) * 100;
}

/**
 * Calculate standard deviation of returns
 * @param returns - Array of daily returns (as decimals)
 * @returns Standard deviation (annualized if more than 1 return)
 */
export function calculateStandardDeviation(returns: number[]): number {
  if (returns.length < 2) {
    return 0;
  }

  const mean = returns.reduce((sum, r) => sum + r, 0) / returns.length;
  const squaredDiffs = returns.map((r) => Math.pow(r - mean, 2));
  const variance = squaredDiffs.reduce((sum, sq) => sum + sq, 0) / (returns.length - 1);

  // Annualize the standard deviation
  return Math.sqrt(variance * TRADING_DAYS_PER_YEAR) * 100;
}

/**
 * Calculate maximum drawdown from price data
 * @param prices - Array of price data
 * @returns Maximum drawdown as percentage (negative value)
 */
export function calculateMaxDrawdown(prices: PriceData[]): number {
  if (prices.length < 2) {
    return 0;
  }

  let maxDrawdown = 0;
  let peak = prices[0].close;

  for (const price of prices) {
    if (price.close > peak) {
      peak = price.close;
    }
    const drawdown = ((price.close - peak) / peak) * 100;
    if (drawdown < maxDrawdown) {
      maxDrawdown = drawdown;
    }
  }

  return maxDrawdown;
}

/**
 * Calculate Sharpe ratio
 * @param returns - Array of daily returns (as decimals)
 * @param riskFreeRate - Annual risk-free rate (default 4%)
 * @returns Sharpe ratio (annualized)
 */
export function calculateSharpeRatio(returns: number[], riskFreeRate: number = RISK_FREE_RATE): number {
  if (returns.length < 2) {
    return 0;
  }

  const meanReturn = returns.reduce((sum, r) => sum + r, 0) / returns.length;
  const annualizedReturn = meanReturn * TRADING_DAYS_PER_YEAR;

  const stdDev = calculateStandardDeviation(returns) / 100; // Convert back to decimal
  if (stdDev === 0) {
    return 0;
  }

  return (annualizedReturn - riskFreeRate) / stdDev;
}

/**
 * Determine risk classification based on standard deviation
 * @param stdDev - Annualized standard deviation (as percentage)
 * @returns Risk classification
 */
export function classifyRisk(stdDev: number): 'low' | 'medium' | 'high' {
  if (stdDev < 15) {
    return 'low';
  } else if (stdDev < 30) {
    return 'medium';
  }
  return 'high';
}

/**
 * Calculate Pearson correlation coefficient between two return series
 * @param returns1 - First array of returns
 * @param returns2 - Second array of returns
 * @returns Correlation coefficient (-1 to +1)
 */
export function calculateCorrelation(returns1: number[], returns2: number[]): number {
  // Use the shorter length
  const n = Math.min(returns1.length, returns2.length);
  if (n < 2) {
    return 0;
  }

  const r1 = returns1.slice(0, n);
  const r2 = returns2.slice(0, n);

  const mean1 = r1.reduce((sum, r) => sum + r, 0) / n;
  const mean2 = r2.reduce((sum, r) => sum + r, 0) / n;

  let numerator = 0;
  let denom1 = 0;
  let denom2 = 0;

  for (let i = 0; i < n; i++) {
    const diff1 = r1[i] - mean1;
    const diff2 = r2[i] - mean2;
    numerator += diff1 * diff2;
    denom1 += diff1 * diff1;
    denom2 += diff2 * diff2;
  }

  const denominator = Math.sqrt(denom1 * denom2);
  if (denominator === 0) {
    return 0;
  }

  return Math.max(-1, Math.min(1, numerator / denominator));
}

/**
 * Determine correlation classification based on coefficient
 * @param coefficient - Correlation coefficient
 * @returns Classification
 */
export function classifyCorrelation(coefficient: number): 'positive' | 'negative' | 'neutral' {
  if (coefficient < -0.3) {
    return 'negative';
  } else if (coefficient > 0.3) {
    return 'positive';
  }
  return 'neutral';
}

/**
 * Build correlation matrix for a set of tickers
 * @param priceDataByTicker - Map of ticker symbol to price data
 * @returns CorrelationMatrix with all pairs and highlights
 */
export function buildCorrelationMatrix(priceDataByTicker: Map<string, PriceData[]>): CorrelationMatrix {
  const tickers = Array.from(priceDataByTicker.keys());
  const entries: CorrelationEntry[] = [];
  const highlyCorrelated: CorrelationEntry[] = [];
  const negativelyCorrelated: CorrelationEntry[] = [];

  for (let i = 0; i < tickers.length; i++) {
    for (let j = i + 1; j < tickers.length; j++) {
      const ticker1 = tickers[i];
      const ticker2 = tickers[j];

      const prices1 = priceDataByTicker.get(ticker1) || [];
      const prices2 = priceDataByTicker.get(ticker2) || [];

      const returns1 = calculateReturns(prices1);
      const returns2 = calculateReturns(prices2);

      const coefficient = calculateCorrelation(returns1, returns2);
      const classification = classifyCorrelation(coefficient);

      const entry: CorrelationEntry = {
        ticker1,
        ticker2,
        coefficient: Math.round(coefficient * 100) / 100,
        classification,
      };

      entries.push(entry);

      if (coefficient > 0.7) {
        highlyCorrelated.push(entry);
      }
      if (coefficient < -0.3) {
        negativelyCorrelated.push(entry);
      }
    }
  }

  return {
    entries,
    highlyCorrelated,
    negativelyCorrelated,
  };
}

/**
 * Calculate performance metrics for multiple tickers
 * @param pricesByTicker - Map of ticker to price data
 * @returns Array of performance metrics sorted by return (descending)
 */
export function calculatePerformanceMetrics(pricesByTicker: Map<string, PriceData[]>): PerformanceMetrics[] {
  const results: PerformanceMetrics[] = [];

  for (const [symbol, prices] of pricesByTicker) {
    const periodReturn = calculatePeriodReturn(prices);
    results.push({
      symbol,
      periodReturn: Math.round(periodReturn * 100) / 100,
      ranking: 0, // Will be set after sorting
      relativeToAverage: 0, // Will be set after sorting
    });
  }

  // Sort by period return (descending) and assign rankings
  results.sort((a, b) => b.periodReturn - a.periodReturn);
  results.forEach((r, index) => {
    r.ranking = index + 1;
  });

  // Calculate average return
  const avgReturn = results.reduce((sum, r) => sum + r.periodReturn, 0) / results.length;

  // Calculate relative to average
  results.forEach((r) => {
    r.relativeToAverage = Math.round((r.periodReturn - avgReturn) * 100) / 100;
  });

  return results;
}

/**
 * Calculate risk metrics for multiple tickers
 * @param pricesByTicker - Map of ticker to price data
 * @returns Array of risk metrics
 */
export function calculateRiskMetrics(pricesByTicker: Map<string, PriceData[]>): RiskMetrics[] {
  const results: RiskMetrics[] = [];

  for (const [symbol, prices] of pricesByTicker) {
    const returns = calculateReturns(prices);
    const stdDev = calculateStandardDeviation(returns);
    const maxDrawdown = calculateMaxDrawdown(prices);
    const sharpeRatio = calculateSharpeRatio(returns);

    results.push({
      symbol,
      standardDeviation: Math.round(stdDev * 100) / 100,
      maxDrawdown: Math.round(maxDrawdown * 100) / 100,
      sharpeRatio: Math.round(sharpeRatio * 100) / 100,
      riskClassification: classifyRisk(stdDev),
    });
  }

  return results;
}
