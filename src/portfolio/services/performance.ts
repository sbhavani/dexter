/**
 * Performance Service
 * Orchestrates performance calculations for portfolio analysis
 */

import type { StockTicker, PerformanceMetrics } from '../types.js';
import {
  calculateDailyReturns,
  calculateTotalReturn,
  calculateAnnualizedReturn,
  calculatePerformanceRanking,
  calculateContribution,
  calculatePortfolioReturn,
} from '../calculations/returns.js';
import { getAdjustedPrices } from '../data-service.js';

/**
 * Calculate performance metrics for all tickers in portfolio
 */
export function calculatePerformanceMetrics(
  stockTickers: StockTicker[],
  weights?: number[]
): PerformanceMetrics[] {
  const tickerReturns = new Map<string, number>();
  const metrics: PerformanceMetrics[] = [];

  // First pass: calculate returns for each ticker
  for (const ticker of stockTickers) {
    const prices = getAdjustedPrices(ticker.prices);
    const totalReturn = calculateTotalReturn(prices);
    tickerReturns.set(ticker.symbol, totalReturn);
  }

  // Calculate portfolio return for contribution calculation
  const tickers = stockTickers.map(t => t.symbol);
  const finalWeights = weights || tickers.map(() => 1 / tickers.length);
  const portfolioReturn = calculatePortfolioReturn(tickerReturns, finalWeights);

  // Calculate rankings
  const rankings = calculatePerformanceRanking(tickerReturns);

  // Second pass: build metrics
  for (const ticker of stockTickers) {
    const prices = getAdjustedPrices(ticker.prices);
    const dailyReturns = calculateDailyReturns(prices);
    const totalReturn = calculateTotalReturn(prices);
    const annualizedReturn = calculateAnnualizedReturn(prices);
    const ranking = rankings.get(ticker.symbol) || 0;
    const weight = finalWeights[tickers.indexOf(ticker.symbol)] || 1 / tickers.length;
    const contribution = calculateContribution(totalReturn, weight);

    metrics.push({
      ticker: ticker.symbol,
      totalReturn,
      annualizedReturn,
      dailyReturns,
      ranking,
      contribution,
    });
  }

  // Sort by ranking
  return metrics.sort((a, b) => a.ranking - b.ranking);
}

/**
 * Calculate relative performance vs benchmark
 */
export function calculateRelativePerformance(
  stockReturns: number[],
  benchmarkReturns: number[]
): number {
  if (stockReturns.length === 0 || benchmarkReturns.length === 0) {
    return 0;
  }

  const stockTotal = stockReturns[stockReturns.length - 1] - stockReturns[0];
  const benchmarkTotal = benchmarkReturns[benchmarkReturns.length - 1] - benchmarkReturns[0];

  return stockTotal - benchmarkTotal;
}

/**
 * Calculate performance for all stocks relative to benchmark
 */
export function calculateBenchmarkRelativePerformance(
  stockTickers: StockTicker[],
  benchmarkPrices: number[]
): Map<string, number> {
  const results = new Map<string, number>();
  const benchmarkReturns = calculateDailyReturns(benchmarkPrices);

  for (const ticker of stockTickers) {
    const prices = getAdjustedPrices(ticker.prices);
    const stockReturns = calculateDailyReturns(prices);

    // Align lengths
    const minLen = Math.min(stockReturns.length, benchmarkReturns.length);
    const alignedStock = stockReturns.slice(0, minLen);
    const alignedBenchmark = benchmarkReturns.slice(0, minLen);

    const relative = calculateRelativePerformance(alignedStock, alignedBenchmark);
    results.set(ticker.symbol, relative);
  }

  return results;
}
