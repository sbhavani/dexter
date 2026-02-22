/**
 * Portfolio Analysis Library
 *
 * Provides functions for analyzing multiple stock tickers including:
 * - Relative performance metrics (total return, annualized return)
 * - Risk metrics (volatility, Sharpe ratio, maximum drawdown)
 * - Correlation coefficients between stocks
 */

export interface PriceData {
  date: string;
  close: number;
}

export interface StockReturns {
  ticker: string;
  dailyReturns: number[];
  prices: number[];
  dates: string[];
}

export interface PerformanceMetrics {
  ticker: string;
  totalReturn: number;
  annualizedReturn: number;
  bestDay: number;
  worstDay: number;
  startPrice: number;
  endPrice: number;
  startDate: string;
  endDate: number;
  tradingDays: number;
}

export interface RiskMetrics {
  ticker: string;
  volatility: number;
  sharpeRatio: number;
  maxDrawdown: number;
  sortinoRatio?: number;
}

export interface CorrelationMatrix {
  tickers: string[];
  matrix: number[][];
}

export interface PortfolioAnalysis {
  performance: PerformanceMetrics[];
  risk: RiskMetrics[];
  correlation: CorrelationMatrix;
  analysisDate: string;
}

/**
 * Calculate daily returns from price data
 */
export function calculateDailyReturns(prices: number[]): number[] {
  if (prices.length < 2) {
    return [];
  }

  const returns: number[] = [];
  for (let i = 1; i < prices.length; i++) {
    const dailyReturn = (prices[i] - prices[i - 1]) / prices[i - 1];
    returns.push(dailyReturn);
  }
  return returns;
}

/**
 * Calculate mean of an array of numbers
 */
export function calculateMean(values: number[]): number {
  if (values.length === 0) return 0;
  return values.reduce((sum, val) => sum + val, 0) / values.length;
}

/**
 * Calculate standard deviation of an array of numbers
 */
export function calculateStandardDeviation(values: number[]): number {
  if (values.length < 2) return 0;
  const mean = calculateMean(values);
  const squaredDiffs = values.map((val) => Math.pow(val - mean, 2));
  const variance = squaredDiffs.reduce((sum, val) => sum + val, 0) / (values.length - 1);
  return Math.sqrt(variance);
}

/**
 * Calculate total return percentage
 */
export function calculateTotalReturn(startPrice: number, endPrice: number): number {
  if (startPrice === 0) return 0;
  return ((endPrice - startPrice) / startPrice) * 100;
}

/**
 * Calculate annualized return
 */
export function calculateAnnualizedReturn(
  startPrice: number,
  endPrice: number,
  tradingDays: number
): number {
  if (startPrice === 0 || tradingDays === 0) return 0;
  const years = tradingDays / 252;
  if (years <= 0) return 0;
  const annualizedReturn = Math.pow(endPrice / startPrice, 1 / years) - 1;
  return annualizedReturn * 100;
}

/**
 * Calculate volatility (annualized standard deviation of returns)
 */
export function calculateVolatility(dailyReturns: number[]): number {
  if (dailyReturns.length < 2) return 0;
  const stdDev = calculateStandardDeviation(dailyReturns);
  return stdDev * Math.sqrt(252) * 100;
}

/**
 * Calculate Sharpe Ratio
 * Assumes risk-free rate of 4% (0.04)
 */
export function calculateSharpeRatio(
  annualizedReturn: number,
  volatility: number,
  riskFreeRate: number = 4
): number {
  if (volatility === 0) return 0;
  return (annualizedReturn - riskFreeRate) / volatility;
}

/**
 * Calculate Maximum Drawdown
 * Returns the maximum drawdown as a positive percentage
 */
export function calculateMaxDrawdown(prices: number[]): number {
  if (prices.length < 2) return 0;

  let maxDrawdown = 0;
  let peak = prices[0];

  for (const price of prices) {
    if (price > peak) {
      peak = price;
    }
    const drawdown = (peak - price) / peak;
    if (drawdown > maxDrawdown) {
      maxDrawdown = drawdown;
    }
  }

  return maxDrawdown * 100;
}

/**
 * Calculate Sortino Ratio (uses downside deviation)
 */
export function calculateSortinoRatio(
  annualizedReturn: number,
  dailyReturns: number[],
  riskFreeRate: number = 4
): number {
  if (dailyReturns.length < 2) return 0;

  // Calculate downside returns (only negative returns)
  const downsideReturns = dailyReturns.filter((r) => r < 0);
  if (downsideReturns.length === 0) return Infinity; // No downside = infinite ratio

  const downsideStdDev = calculateStandardDeviation(downsideReturns);
  const downsideVolatility = downsideStdDev * Math.sqrt(252);

  if (downsideVolatility === 0) return 0;
  return (annualizedReturn - riskFreeRate) / downsideVolatility;
}

/**
 * Calculate Pearson correlation coefficient between two return series
 */
export function calculateCorrelation(returnsA: number[], returnsB: number[]): number {
  // Ensure both arrays are the same length
  const minLength = Math.min(returnsA.length, returnsB.length);
  if (minLength < 2) return 0;

  const sliceA = returnsA.slice(0, minLength);
  const sliceB = returnsB.slice(0, minLength);

  const meanA = calculateMean(sliceA);
  const meanB = calculateMean(sliceB);

  let numerator = 0;
  let sumSquaredA = 0;
  let sumSquaredB = 0;

  for (let i = 0; i < minLength; i++) {
    const diffA = sliceA[i] - meanA;
    const diffB = sliceB[i] - meanB;
    numerator += diffA * diffB;
    sumSquaredA += diffA * diffA;
    sumSquaredB += diffB * diffB;
  }

  const denominator = Math.sqrt(sumSquaredA * sumSquaredB);
  if (denominator === 0) return 0;

  return numerator / denominator;
}

/**
 * Build correlation matrix for multiple tickers
 */
export function buildCorrelationMatrix(stockReturns: StockReturns[]): CorrelationMatrix {
  const tickers = stockReturns.map((sr) => sr.ticker);
  const n = tickers.length;
  const matrix: number[][] = [];

  for (let i = 0; i < n; i++) {
    matrix[i] = [];
    for (let j = 0; j < n; j++) {
      if (i === j) {
        matrix[i][j] = 1.0;
      } else {
        const correlation = calculateCorrelation(
          stockReturns[i].dailyReturns,
          stockReturns[j].dailyReturns
        );
        matrix[i][j] = correlation;
      }
    }
  }

  return { tickers, matrix };
}

/**
 * Calculate performance metrics for a single stock
 */
export function calculatePerformanceMetrics(
  ticker: string,
  prices: number[],
  dates: string[]
): PerformanceMetrics {
  const dailyReturns = calculateDailyReturns(prices);

  const startPrice = prices[0];
  const endPrice = prices[prices.length - 1];
  const tradingDays = prices.length;

  const totalReturn = calculateTotalReturn(startPrice, endPrice);
  const annualizedReturn = calculateAnnualizedReturn(startPrice, endPrice, tradingDays);

  const bestDay = dailyReturns.length > 0 ? Math.max(...dailyReturns) * 100 : 0;
  const worstDay = dailyReturns.length > 0 ? Math.min(...dailyReturns) * 100 : 0;

  return {
    ticker,
    totalReturn,
    annualizedReturn,
    bestDay,
    worstDay,
    startPrice,
    endPrice,
    startDate: dates[0],
    endDate: tradingDays,
    tradingDays,
  };
}

/**
 * Calculate risk metrics for a single stock
 */
export function calculateRiskMetrics(ticker: string, prices: number[]): RiskMetrics {
  const dailyReturns = calculateDailyReturns(prices);

  const volatility = calculateVolatility(dailyReturns);
  const annualizedReturn = calculateAnnualizedReturn(
    prices[0],
    prices[prices.length - 1],
    prices.length
  );
  const sharpeRatio = calculateSharpeRatio(annualizedReturn, volatility);
  const maxDrawdown = calculateMaxDrawdown(prices);
  const sortinoRatio = calculateSortinoRatio(annualizedReturn, dailyReturns);

  return {
    ticker,
    volatility,
    sharpeRatio,
    maxDrawdown,
    sortinoRatio,
  };
}

/**
 * Main function to perform portfolio analysis
 */
export function analyzePortfolio(priceDataMap: Map<string, PriceData[]>): PortfolioAnalysis {
  const tickers = Array.from(priceDataMap.keys());
  const analysisDate = new Date().toISOString().split('T')[0];

  // Build stock returns for each ticker
  const stockReturns: StockReturns[] = [];
  const performance: PerformanceMetrics[] = [];
  const risk: RiskMetrics[] = [];

  for (const ticker of tickers) {
    const priceData = priceDataMap.get(ticker) || [];
    const prices = priceData.map((p) => p.close);
    const dates = priceData.map((p) => p.date);

    if (prices.length < 2) continue;

    const dailyReturns = calculateDailyReturns(prices);

    stockReturns.push({
      ticker,
      dailyReturns,
      prices,
      dates,
    });

    performance.push(calculatePerformanceMetrics(ticker, prices, dates));
    risk.push(calculateRiskMetrics(ticker, prices));
  }

  const correlation = buildCorrelationMatrix(stockReturns);

  return {
    performance,
    risk,
    correlation,
    analysisDate,
  };
}

/**
 * Format performance metrics for display
 */
export function formatPerformanceTable(performance: PerformanceMetrics[]): string {
  const header = '| Ticker | Total Return | Annualized Return | Best Day | Worst Day |';
  const separator = '|--------|--------------|-------------------|----------|-----------|';

  const rows = performance.map((p) => {
    return `| ${p.ticker.padEnd(6)} | ${p.totalReturn >= 0 ? '+' : ''}${p.totalReturn.toFixed(2)}% | ${p.annualizedReturn >= 0 ? '+' : ''}${p.annualizedReturn.toFixed(2)}% | ${p.bestDay >= 0 ? '+' : ''}${p.bestDay.toFixed(2)}% | ${p.worstDay >= 0 ? '+' : ''}${p.worstDay.toFixed(2)}% |`;
  });

  return [header, separator, ...rows].join('\n');
}

/**
 * Format risk metrics for display
 */
export function formatRiskTable(risk: RiskMetrics[]): string {
  const header = '| Ticker | Volatility | Sharpe Ratio | Max Drawdown |';
  const separator = '|--------|------------|--------------|--------------|';

  const rows = risk.map((r) => {
    return `| ${r.ticker.padEnd(6)} | ${r.volatility.toFixed(2)}% | ${r.sharpeRatio.toFixed(2)} | -${r.maxDrawdown.toFixed(2)}% |`;
  });

  return [header, separator, ...rows].join('\n');
}

/**
 * Format correlation matrix for display
 */
export function formatCorrelationMatrix(correlation: CorrelationMatrix): string {
  const { tickers, matrix } = correlation;
  const n = tickers.length;

  // Build header row
  const header = '| ' + tickers.map((t) => t.padEnd(8)).join(' | ') + ' |';
  const separator = '|' + tickers.map(() => '----------').join('|') + '|';

  // Build data rows
  const rows: string[] = [];
  for (let i = 0; i < n; i++) {
    const rowValues = matrix[i].map((v) => {
      const formatted = v >= 0 ? `+${v.toFixed(2)}` : v.toFixed(2);
      return formatted.padStart(8);
    });
    rows.push(`| ${tickers[i].padEnd(6)} | ${rowValues.join(' | ')} |`);
  }

  return [header, separator, ...rows].join('\n');
}

/**
 * Generate key insights from portfolio analysis
 */
export function generateInsights(
  performance: PerformanceMetrics[],
  risk: RiskMetrics[],
  correlation: CorrelationMatrix
): string[] {
  const insights: string[] = [];

  // Best performer
  const bestPerformer = performance.reduce((best, p) =>
    p.annualizedReturn > best.annualizedReturn ? p : best
  );
  insights.push(
    `Highest performer: ${bestPerformer.ticker} with ${bestPerformer.annualizedReturn >= 0 ? '+' : ''}${bestPerformer.annualizedReturn.toFixed(2)}% annualized return`
  );

  // Best risk-adjusted return
  const bestSharpe = risk.reduce((best, r) => (r.sharpeRatio > best.sharpeRatio ? r : best));
  insights.push(
    `Best risk-adjusted return: ${bestSharpe.ticker} with Sharpe ratio of ${bestSharpe.sharpeRatio.toFixed(2)}`
  );

  // Best diversification pair (lowest correlation)
  const { tickers, matrix } = correlation;
  let minCorrelation = 1;
  let minPair = [tickers[0], tickers[1]];

  for (let i = 0; i < tickers.length; i++) {
    for (let j = i + 1; j < tickers.length; j++) {
      if (matrix[i][j] < minCorrelation) {
        minCorrelation = matrix[i][j];
        minPair = [tickers[i], tickers[j]];
      }
    }
  }
  insights.push(
    `Best diversification pair: ${minPair[0]} and ${minPair[1]} (correlation: ${minCorrelation.toFixed(2)})`
  );

  // Highest risk
  const highestVolatility = risk.reduce((max, r) =>
    r.volatility > max.volatility ? r : max
  );
  insights.push(
    `Highest volatility: ${highestVolatility.ticker} at ${highestVolatility.volatility.toFixed(2)}%`
  );

  return insights;
}
