/**
 * Portfolio Analysis Module
 * Main entry point for portfolio analysis functionality
 */

import type {
  PortfolioAnalysis,
  PortfolioCLIOptions,
} from './types.js';
import { validateTickers, validateWeights, validateDateRange } from './validation.js';
import { parsePeriod } from './parser.js';
import {
  fetchPricesForTickers,
  fetchBenchmarkData,
  validateDataSufficiency,
  toStockTickers,
} from './data-service.js';
import { calculatePerformanceMetrics } from './services/performance.js';
import { calculateRiskMetrics, calculatePortfolioRiskMetrics } from './services/risk.js';
import { calculateCorrelationData } from './services/correlation.js';
import { formatPortfolioTable } from './formatters/table.js';
import { formatPortfolioJSON } from './formatters/json.js';

const DEFAULT_BENCHMARK = '^GSPC';
const MIN_DATA_DAYS = 30;

/**
 * Main portfolio analysis function
 */
export async function analyzePortfolio(
  options: PortfolioCLIOptions
): Promise<{ result: PortfolioAnalysis; output: string }> {
  // Validate inputs
  const tickerValidation = validateTickers(options.tickers);
  if (!tickerValidation.valid) {
    throw new Error(`Invalid tickers: ${tickerValidation.errors.join(', ')}`);
  }

  if (options.weights) {
    const weightValidation = validateWeights(options.tickers, options.weights);
    if (!weightValidation.valid) {
      throw new Error(`Invalid weights: ${weightValidation.errors.join(', ')}`);
    }
  }

  // Parse period to dates
  const periodDates = parsePeriod(options.period);
  const startDate = options.startDate || periodDates.startDate;
  const endDate = options.endDate || periodDates.endDate;

  const dateValidation = validateDateRange(startDate, endDate);
  if (!dateValidation.valid) {
    throw new Error(`Invalid date range: ${dateValidation.errors.join(', ')}`);
  }

  // Fetch prices for all tickers
  const priceData = await fetchPricesForTickers(
    options.tickers,
    startDate,
    endDate
  );

  // Check data sufficiency
  const validation = validateDataSufficiency(priceData);
  if (!validation.sufficient) {
    throw new Error(`Insufficient data: ${validation.errors.join('; ')}`);
  }

  // Convert to StockTicker array
  const stockTickers = toStockTickers(priceData);

  if (stockTickers.length === 0) {
    throw new Error('No valid price data retrieved for any ticker');
  }

  // Validate we have enough tickers
  if (stockTickers.length < 2) {
    throw new Error('Need at least 2 valid tickers for portfolio analysis');
  }

  // Fetch benchmark data
  const benchmarkTicker = options.benchmark || DEFAULT_BENCHMARK;
  const benchmarkPrices = await fetchBenchmarkData(startDate, endDate, benchmarkTicker);
  const benchmarkArray = benchmarkPrices.map(p => p.adjustedClose || p.close);

  // Calculate weights
  const tickers = stockTickers.map(t => t.symbol);
  const weights = options.weights || tickers.map(() => 1 / tickers.length);

  // Calculate metrics
  const performance = calculatePerformanceMetrics(stockTickers, weights);
  const risk = calculateRiskMetrics(stockTickers, benchmarkArray);
  const correlation = calculateCorrelationData(stockTickers);

  // Calculate portfolio-level risk
  const portfolioReturn = performance.reduce((sum, p) => sum + p.contribution, 0);
  const portfolioRisk = calculatePortfolioRiskMetrics(
    stockTickers,
    weights,
    correlation.matrix,
    portfolioReturn
  );

  // Build result
  const result: PortfolioAnalysis = {
    portfolio: {
      tickers,
      dateRange: { start: startDate, end: endDate },
      period: options.period,
      weighting: options.weights ? 'custom' : 'equal',
      weights: options.weights,
    },
    performance,
    risk,
    portfolioRisk,
    correlation,
    metadata: {
      calculatedAt: new Date().toISOString(),
      dataPoints: stockTickers[0]?.prices.length || 0,
      riskFreeRate: 4.5,
    },
  };

  // Format output
  const output = options.json
    ? formatPortfolioJSON(result)
    : formatPortfolioTable(result);

  return { result, output };
}

// Re-export types and utilities
export * from './types.js';
export * from './validation.js';
export * from './parser.js';
