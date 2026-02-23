/**
 * Correlation Service
 * Orchestrates correlation analysis for portfolio
 */

import type { StockTicker, CorrelationData } from '../types.js';
import {
  calculateCorrelationMatrix,
  findHighCorrelations,
  findLowCorrelations,
  preparePriceDataForCorrelation,
} from '../calculations/correlation.js';
import { getAdjustedPrices } from '../data-service.js';

/**
 * Calculate correlation data for portfolio
 */
export function calculateCorrelationData(
  stockTickers: StockTicker[]
): CorrelationData {
  // Prepare price data (converted to daily returns)
  const pricesMap = new Map<string, number[]>();
  for (const ticker of stockTickers) {
    const prices = getAdjustedPrices(ticker.prices);
    pricesMap.set(ticker.symbol, prices);
  }

  const returnsMap = preparePriceDataForCorrelation(pricesMap);

  // Calculate correlation matrix
  const { matrix, tickers } = calculateCorrelationMatrix(returnsMap);

  // Find high and low correlations
  const highCorrelations = findHighCorrelations(matrix, tickers, 0.7);
  const lowCorrelations = findLowCorrelations(matrix, tickers, 0.3);

  return {
    tickers,
    matrix,
    highCorrelations,
    lowCorrelations,
  };
}

/**
 * Get diversification recommendations based on correlation
 */
export function getDiversificationRecommendations(
  correlationData: CorrelationData
): string[] {
  const recommendations: string[] = [];

  // Check for high correlations
  if (correlationData.highCorrelations.length > 0) {
    recommendations.push(
      `Warning: ${correlationData.highCorrelations.length} ticker pairs have high correlation (>0.7), which may reduce diversification benefits.`
    );
  }

  // Check for good diversification
  if (correlationData.lowCorrelations.length > 0) {
    recommendations.push(
      `Good: ${correlationData.lowCorrelations.length} ticker pairs have low correlation (<0.3), indicating good diversification.`
    );
  }

  // Check for negative correlations
  const negativeCount = correlationData.lowCorrelations.filter(
    ([, , corr]) => corr < 0
  ).length;

  if (negativeCount > 0) {
    recommendations.push(
      `Excellent: ${negativeCount} ticker pairs have negative correlation, providing strong diversification.`
    );
  }

  return recommendations;
}
