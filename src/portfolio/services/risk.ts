/**
 * Risk Service
 * Orchestrates risk calculations for portfolio analysis
 */

import type { StockTicker, RiskMetrics, PortfolioRiskMetrics } from '../types.js';
import {
  calculateVolatility,
  calculateSharpeRatio,
  calculateBeta,
  calculateValueAtRisk,
  calculatePortfolioVolatility,
  calculatePortfolioSharpeRatio,
} from '../calculations/risk.js';
import { calculateDailyReturns } from '../calculations/returns.js';
import { getAdjustedPrices } from '../data-service.js';

const DEFAULT_RISK_FREE_RATE = 4.5;
const DEFAULT_CONFIDENCE_LEVEL = 0.95;

/**
 * Calculate risk metrics for all tickers in portfolio
 */
export function calculateRiskMetrics(
  stockTickers: StockTicker[],
  benchmarkPrices: number[]
): RiskMetrics[] {
  const metrics: RiskMetrics[] = [];
  const benchmarkReturns = calculateDailyReturns(benchmarkPrices);

  for (const ticker of stockTickers) {
    const prices = getAdjustedPrices(ticker.prices);
    const dailyReturns = calculateDailyReturns(prices);

    const volatility = calculateVolatility(dailyReturns);
    const annualizedReturn = calculateAnnualizedReturnFromReturns(dailyReturns);
    const sharpeRatio = calculateSharpeRatio(annualizedReturn, volatility, DEFAULT_RISK_FREE_RATE);

    // Calculate beta
    const alignedStock = alignReturns(dailyReturns, benchmarkReturns);
    const alignedBenchmark = alignReturns(benchmarkReturns, dailyReturns);
    const beta = calculateBeta(alignedStock, alignedBenchmark);

    metrics.push({
      ticker: ticker.symbol,
      volatility,
      sharpeRatio,
      beta,
    });
  }

  return metrics;
}

/**
 * Calculate portfolio-level risk metrics
 */
export function calculatePortfolioRiskMetrics(
  stockTickers: StockTicker[],
  weights: number[],
  correlationMatrix: number[][],
  portfolioReturn: number
): PortfolioRiskMetrics {
  const volatilities = stockTickers.map(t => {
    const prices = getAdjustedPrices(t.prices);
    const dailyReturns = calculateDailyReturns(prices);
    return calculateVolatility(dailyReturns);
  });

  const portfolioVolatility = calculatePortfolioVolatility(
    weights.map(w => w * 100), // Convert to percentage
    volatilities,
    correlationMatrix
  );

  const portfolioSharpe = calculatePortfolioSharpeRatio(
    portfolioReturn,
    portfolioVolatility,
    DEFAULT_RISK_FREE_RATE
  );

  // Calculate portfolio VaR
  const allDailyReturns: number[] = [];
  for (let i = 0; i < stockTickers.length; i++) {
    const prices = getAdjustedPrices(stockTickers[i].prices);
    const dailyReturns = calculateDailyReturns(prices);
    const weight = weights[i];
    for (const ret of dailyReturns) {
      allDailyReturns.push(ret * weight);
    }
  }

  const varValue = calculateValueAtRisk(allDailyReturns, DEFAULT_CONFIDENCE_LEVEL);

  return {
    volatility: portfolioVolatility,
    sharpeRatio: portfolioSharpe,
    valueAtRisk: varValue,
    confidenceLevel: DEFAULT_CONFIDENCE_LEVEL,
  };
}

/**
 * Calculate annualized return from daily returns
 */
function calculateAnnualizedReturnFromReturns(dailyReturns: number[]): number {
  if (dailyReturns.length === 0) return 0;

  // Calculate cumulative return
  let cumulative = 1;
  for (const ret of dailyReturns) {
    cumulative *= (1 + ret);
  }

  // Annualize
  const days = dailyReturns.length + 1;
  const annualizedReturn = Math.pow(cumulative, 252 / days) - 1;

  return annualizedReturn * 100;
}

/**
 * Align two return arrays to same length
 */
function alignReturns(a: number[], b: number[]): number[] {
  const minLen = Math.min(a.length, b.length);
  return a.slice(0, minLen);
}
