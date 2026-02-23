/**
 * Risk Calculations
 * Calculate volatility, Sharpe ratio, beta, and Value at Risk
 */

import { calculateDailyReturns } from './returns.js';

const TRADING_DAYS_PER_YEAR = 252;
const DEFAULT_RISK_FREE_RATE = 4.5; // Annual risk-free rate in percentage

/**
 * Calculate mean of an array
 */
function calculateMean(values: number[]): number {
  if (values.length === 0) return 0;
  return values.reduce((sum, v) => sum + v, 0) / values.length;
}

/**
 * Calculate standard deviation
 */
function calculateStandardDeviation(values: number[]): number {
  if (values.length < 2) return 0;

  const mean = calculateMean(values);
  const squaredDiffs = values.map(v => Math.pow(v - mean, 2));
  const variance = squaredDiffs.reduce((sum, v) => sum + v, 0) / (values.length - 1);

  return Math.sqrt(variance);
}

/**
 * Calculate volatility (annualized standard deviation)
 * Volatility = StdDev(daily returns) * sqrt(252)
 */
export function calculateVolatility(dailyReturns: number[]): number {
  if (dailyReturns.length < 2) {
    return 0;
  }

  const stdDev = calculateStandardDeviation(dailyReturns);
  return stdDev * Math.sqrt(TRADING_DAYS_PER_YEAR) * 100; // Convert to percentage
}

/**
 * Calculate Sharpe Ratio
 * Sharpe Ratio = (Annualized Return - Risk-Free Rate) / Volatility
 */
export function calculateSharpeRatio(
  annualizedReturn: number,
  volatility: number,
  riskFreeRate: number = DEFAULT_RISK_FREE_RATE
): number {
  if (volatility === 0) {
    return 0;
  }

  return (annualizedReturn - riskFreeRate) / volatility;
}

/**
 * Calculate beta against benchmark
 * Beta = Covariance(Stock Returns, Benchmark Returns) / Variance(Benchmark Returns)
 */
export function calculateBeta(
  stockReturns: number[],
  benchmarkReturns: number[]
): number {
  if (stockReturns.length !== benchmarkReturns.length || stockReturns.length < 2) {
    return 1; // Default to market beta
  }

  const stockMean = calculateMean(stockReturns);
  const benchmarkMean = calculateMean(benchmarkReturns);

  let covariance = 0;
  let benchmarkVariance = 0;

  for (let i = 0; i < stockReturns.length; i++) {
    const stockDiff = stockReturns[i] - stockMean;
    const benchmarkDiff = benchmarkReturns[i] - benchmarkMean;
    covariance += stockDiff * benchmarkDiff;
    benchmarkVariance += benchmarkDiff * benchmarkDiff;
  }

  covariance /= (stockReturns.length - 1);
  benchmarkVariance /= (benchmarkReturns.length - 1);

  if (benchmarkVariance === 0) {
    return 1;
  }

  return covariance / benchmarkVariance;
}

/**
 * Calculate Value at Risk (VaR) - Parametric/Analytical method
 * VaR = Portfolio Value * (Mean Return - Z * StdDev)
 *
 * @param dailyReturns - Array of daily returns
 * @param confidenceLevel - Confidence level (e.g., 0.95 for 95%)
 * @returns VaR as a percentage
 */
export function calculateValueAtRisk(
  dailyReturns: number[],
  confidenceLevel: number = 0.95
): number {
  if (dailyReturns.length < 2) {
    return 0;
  }

  // Z-score for confidence level
  const zScores: Record<number, number> = {
    0.90: 1.28,
    0.95: 1.65,
    0.99: 2.33,
  };

  const z = zScores[confidenceLevel] || 1.65;
  const mean = calculateMean(dailyReturns);
  const stdDev = calculateStandardDeviation(dailyReturns);

  // VaR as a percentage
  const varPercentage = (mean - z * stdDev) * 100;

  return Math.abs(varPercentage);
}

/**
 * Calculate portfolio-level volatility
 * Uses weighted average with correlation consideration
 */
export function calculatePortfolioVolatility(
  weights: number[],
  volatilities: number[],
  correlationMatrix: number[][]
): number {
  if (weights.length !== volatilities.length || weights.length === 0) {
    return 0;
  }

  let variance = 0;

  for (let i = 0; i < weights.length; i++) {
    for (let j = 0; j < weights.length; j++) {
      const wi = weights[i] / 100; // Convert from percentage
      const wj = weights[j] / 100;
      const vi = volatilities[i] / 100;
      const vj = volatilities[j] / 100;
      const corr = correlationMatrix[i]?.[j] || 0;

      variance += wi * wj * vi * vj * corr;
    }
  }

  return Math.sqrt(variance) * 100; // Convert back to percentage
}

/**
 * Calculate portfolio-level Sharpe ratio
 */
export function calculatePortfolioSharpeRatio(
  portfolioReturn: number,
  portfolioVolatility: number,
  riskFreeRate: number = DEFAULT_RISK_FREE_RATE
): number {
  if (portfolioVolatility === 0) {
    return 0;
  }

  return (portfolioReturn - riskFreeRate) / portfolioVolatility;
}
