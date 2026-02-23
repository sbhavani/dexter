/**
 * Correlation Calculations
 * Calculate Pearson correlation coefficients and build correlation matrix
 */

import { calculateDailyReturns } from './returns.js';

/**
 * Calculate mean of an array
 */
function calculateMean(values: number[]): number {
  if (values.length === 0) return 0;
  return values.reduce((sum, v) => sum + v, 0) / values.length;
}

/**
 * Calculate Pearson correlation coefficient
 * Correlation = Covariance(X, Y) / (StdDev(X) * StdDev(Y))
 */
export function calculateCorrelation(x: number[], y: number[]): number {
  if (x.length !== y.length || x.length < 2) {
    return 0;
  }

  const xMean = calculateMean(x);
  const yMean = calculateMean(y);

  let covariance = 0;
  let xVarianceSum = 0;
  let yVarianceSum = 0;

  for (let i = 0; i < x.length; i++) {
    const xDiff = x[i] - xMean;
    const yDiff = y[i] - yMean;
    covariance += xDiff * yDiff;
    xVarianceSum += xDiff * xDiff;
    yVarianceSum += yDiff * yDiff;
  }

  const xStdDev = Math.sqrt(xVarianceSum / (x.length - 1));
  const yStdDev = Math.sqrt(yVarianceSum / (y.length - 1));

  if (xStdDev === 0 || yStdDev === 0) {
    return 0;
  }

  // Normalize covariance by (n-1) for sample covariance
  return (covariance / (x.length - 1)) / (xStdDev * yStdDev);
}

/**
 * Calculate correlation matrix for multiple tickers
 */
export function calculateCorrelationMatrix(
  priceData: Map<string, number[]>
): { matrix: number[][]; tickers: string[] } {
  const tickers = [...priceData.keys()];
  const n = tickers.length;
  const matrix: number[][] = [];

  for (let i = 0; i < n; i++) {
    matrix[i] = [];
    for (let j = 0; j < n; j++) {
      if (i === j) {
        matrix[i][j] = 1; // Correlation with self is always 1
      } else {
        const pricesI = priceData.get(tickers[i]) || [];
        const pricesJ = priceData.get(tickers[j]) || [];
        matrix[i][j] = calculateCorrelation(pricesI, pricesJ);
      }
    }
  }

  return { matrix, tickers };
}

/**
 * Identify high correlation pairs (> 0.7)
 */
export function findHighCorrelations(
  matrix: number[][],
  tickers: string[],
  threshold: number = 0.7
): [string, string, number][] {
  const highCorrelations: [string, string, number][] = [];

  for (let i = 0; i < tickers.length; i++) {
    for (let j = i + 1; j < tickers.length; j++) {
      const corr = matrix[i][j];
      if (corr > threshold) {
        highCorrelations.push([tickers[i], tickers[j], corr]);
      }
    }
  }

  // Sort by correlation (highest first)
  return highCorrelations.sort((a, b) => b[2] - a[2]);
}

/**
 * Identify low/negative correlation pairs (< 0.3)
 */
export function findLowCorrelations(
  matrix: number[][],
  tickers: string[],
  threshold: number = 0.3
): [string, string, number][] {
  const lowCorrelations: [string, string, number][] = [];

  for (let i = 0; i < tickers.length; i++) {
    for (let j = i + 1; j < tickers.length; j++) {
      const corr = matrix[i][j];
      if (corr < threshold) {
        lowCorrelations.push([tickers[i], tickers[j], corr]);
      }
    }
  }

  // Sort by correlation (lowest first)
  return lowCorrelations.sort((a, b) => a[2] - b[2]);
}

/**
 * Prepare price data for correlation calculation
 * Converts price arrays to daily returns arrays
 */
export function preparePriceDataForCorrelation(
  pricesMap: Map<string, number[]>
): Map<string, number[]> {
  const returnsMap = new Map<string, number[]>();

  // Find the minimum length across all price arrays
  let minLength = Infinity;
  for (const prices of pricesMap.values()) {
    minLength = Math.min(minLength, prices.length);
  }

  if (minLength === Infinity || minLength < 2) {
    return returnsMap;
  }

  // Trim all arrays to same length and calculate returns
  for (const [ticker, prices] of pricesMap) {
    const trimmed = prices.slice(0, minLength);
    const returns = calculateDailyReturns(trimmed);
    if (returns.length > 0) {
      returnsMap.set(ticker, returns);
    }
  }

  return returnsMap;
}
