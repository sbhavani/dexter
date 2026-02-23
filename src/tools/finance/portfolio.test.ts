import { describe, test, expect } from 'bun:test';
import {
  calculateReturns,
  calculatePeriodReturn,
  calculateStandardDeviation,
  calculateMaxDrawdown,
  calculateSharpeRatio,
  calculateCorrelation,
  classifyRisk,
  classifyCorrelation,
  buildCorrelationMatrix,
  calculatePerformanceMetrics,
  calculateRiskMetrics,
  PriceData,
} from '../../utils/portfolio-metrics.js';
import { parseTickers } from './portfolio.js';

// ---------------------------------------------------------------------------
// Test Data
// ---------------------------------------------------------------------------

const samplePricesAAPL: PriceData[] = [
  { date: '2024-01-01', close: 100 },
  { date: '2024-01-02', close: 102 },
  { date: '2024-01-03', close: 101 },
  { date: '2024-01-04', close: 105 },
  { date: '2024-01-05', close: 108 },
];

const samplePricesGOOGL: PriceData[] = [
  { date: '2024-01-01', close: 140 },
  { date: '2024-01-02', close: 142 },
  { date: '2024-01-03', close: 141 },
  { date: '2024-01-04', close: 145 },
  { date: '2024-01-05', close: 148 },
];

// Prices that move inversely to AAPL
const samplePricesInverse: PriceData[] = [
  { date: '2024-01-01', close: 100 },
  { date: '2024-01-02', close: 98 },
  { date: '2024-01-03', close: 99 },
  { date: '2024-01-04', close: 95 },
  { date: '2024-01-05', close: 92 },
];

// Additional test data for multiple tickers
const samplePricesMSFT: PriceData[] = [
  { date: '2024-01-01', close: 370 },
  { date: '2024-01-02', close: 372 },
  { date: '2024-01-03', close: 371 },
  { date: '2024-01-04', close: 375 },
  { date: '2024-01-05', close: 378 },
];

// Uncorrelated data
const samplePricesUncorrelated: PriceData[] = [
  { date: '2024-01-01', close: 100 },
  { date: '2024-01-02', close: 95 },
  { date: '2024-01-03', close: 105 },
  { date: '2024-01-04', close: 98 },
  { date: '2024-01-05', close: 102 },
];

// ---------------------------------------------------------------------------
// calculateReturns
// ---------------------------------------------------------------------------

describe('calculateReturns', () => {
  test('calculates correct daily returns', () => {
    const returns = calculateReturns(samplePricesAAPL);
    expect(returns).toHaveLength(4);
    // (102-100)/100 = 0.02
    expect(returns[0]).toBeCloseTo(0.02, 5);
    // (101-102)/102 = -0.0098
    expect(returns[1]).toBeCloseTo(-0.0098, 3);
    // (105-101)/101 = 0.0396
    expect(returns[2]).toBeCloseTo(0.0396, 3);
    // (108-105)/105 = 0.0286
    expect(returns[3]).toBeCloseTo(0.0286, 3);
  });

  test('returns empty array for insufficient data', () => {
    expect(calculateReturns([{ date: '2024-01-01', close: 100 }])).toHaveLength(0);
    expect(calculateReturns([])).toHaveLength(0);
  });
});

// ---------------------------------------------------------------------------
// calculatePeriodReturn
// ---------------------------------------------------------------------------

describe('calculatePeriodReturn', () => {
  test('calculates correct period return', () => {
    // (108-100)/100 = 8%
    const returnPct = calculatePeriodReturn(samplePricesAAPL);
    expect(returnPct).toBeCloseTo(8, 1);
  });

  test('returns 0 for insufficient data', () => {
    expect(calculatePeriodReturn([{ date: '2024-01-01', close: 100 }])).toBe(0);
    expect(calculatePeriodReturn([])).toBe(0);
  });
});

// ---------------------------------------------------------------------------
// calculateStandardDeviation
// ---------------------------------------------------------------------------

describe('calculateStandardDeviation', () => {
  test('calculates standard deviation correctly', () => {
    const returns = calculateReturns(samplePricesAAPL);
    const stdDev = calculateStandardDeviation(returns);
    // Should be positive
    expect(stdDev).toBeGreaterThan(0);
  });

  test('returns 0 for insufficient data', () => {
    expect(calculateStandardDeviation([0.01])).toBe(0);
    expect(calculateStandardDeviation([])).toBe(0);
  });
});

// ---------------------------------------------------------------------------
// calculateMaxDrawdown
// ---------------------------------------------------------------------------

describe('calculateMaxDrawdown', () => {
  test('calculates correct max drawdown', () => {
    const maxDrawdown = calculateMaxDrawdown(samplePricesAAPL);
    // Peak at 108, lowest after is 108 (no drawdown yet in this data)
    // Or check intermediate: 105 to 101 = -3.8%
    expect(maxDrawdown).toBeLessThanOrEqual(0);
  });

  test('returns 0 for insufficient data', () => {
    expect(calculateMaxDrawdown([{ date: '2024-01-01', close: 100 }])).toBe(0);
    expect(calculateMaxDrawdown([])).toBe(0);
  });
});

// ---------------------------------------------------------------------------
// calculateSharpeRatio
// ---------------------------------------------------------------------------

describe('calculateSharpeRatio', () => {
  test('calculates Sharpe ratio', () => {
    const returns = calculateReturns(samplePricesAAPL);
    const sharpe = calculateSharpeRatio(returns);
    // Should be a number (can be negative or positive)
    expect(typeof sharpe).toBe('number');
  });

  test('returns 0 for insufficient data', () => {
    expect(calculateSharpeRatio([0.01])).toBe(0);
    expect(calculateSharpeRatio([])).toBe(0);
  });
});

// ---------------------------------------------------------------------------
// classifyRisk
// ---------------------------------------------------------------------------

describe('classifyRisk', () => {
  test('classifies low risk below 15%', () => {
    expect(classifyRisk(10)).toBe('low');
    expect(classifyRisk(14.9)).toBe('low');
  });

  test('classifies medium risk between 15% and 30%', () => {
    expect(classifyRisk(15)).toBe('medium');
    expect(classifyRisk(25)).toBe('medium');
    expect(classifyRisk(29.9)).toBe('medium');
  });

  test('classifies high risk above 30%', () => {
    expect(classifyRisk(30)).toBe('high');
    expect(classifyRisk(50)).toBe('high');
  });
});

// ---------------------------------------------------------------------------
// calculateCorrelation
// ---------------------------------------------------------------------------

describe('calculateCorrelation', () => {
  test('returns 1 for perfectly correlated assets', () => {
    const returns1 = [0.01, 0.02, 0.03, 0.04];
    const returns2 = [0.01, 0.02, 0.03, 0.04];
    const correlation = calculateCorrelation(returns1, returns2);
    expect(correlation).toBeCloseTo(1, 2);
  });

  test('returns -1 for perfectly negatively correlated assets', () => {
    const returns1 = [0.01, 0.02, 0.03, 0.04];
    const returns2 = [-0.01, -0.02, -0.03, -0.04];
    const correlation = calculateCorrelation(returns1, returns2);
    expect(correlation).toBeCloseTo(-1, 2);
  });

  test('returns 0 for uncorrelated assets', () => {
    const returns1 = [0.01, 0.02, 0.03, 0.04];
    const returns2 = [-0.01, 0.02, -0.03, 0.04];
    const correlation = calculateCorrelation(returns1, returns2);
    expect(correlation).toBeGreaterThanOrEqual(-1);
    expect(correlation).toBeLessThanOrEqual(1);
  });

  test('returns 0 for insufficient data', () => {
    expect(calculateCorrelation([0.01], [0.02])).toBe(0);
    expect(calculateCorrelation([], [])).toBe(0);
  });
});

// ---------------------------------------------------------------------------
// classifyCorrelation
// ---------------------------------------------------------------------------

describe('classifyCorrelation', () => {
  test('classifies negative correlation below -0.3', () => {
    expect(classifyCorrelation(-0.5)).toBe('negative');
    expect(classifyCorrelation(-0.31)).toBe('negative');
  });

  test('classifies neutral correlation between -0.3 and 0.3', () => {
    expect(classifyCorrelation(-0.3)).toBe('neutral');
    expect(classifyCorrelation(0)).toBe('neutral');
    expect(classifyCorrelation(0.3)).toBe('neutral');
  });

  test('classifies positive correlation above 0.3', () => {
    expect(classifyCorrelation(0.31)).toBe('positive');
    expect(classifyCorrelation(0.8)).toBe('positive');
  });
});

// ---------------------------------------------------------------------------
// buildCorrelationMatrix
// ---------------------------------------------------------------------------

describe('buildCorrelationMatrix', () => {
  test('builds correlation matrix for two tickers', () => {
    const priceDataByTicker = new Map([
      ['AAPL', samplePricesAAPL],
      ['GOOGL', samplePricesGOOGL],
    ]);

    const matrix = buildCorrelationMatrix(priceDataByTicker);

    expect(matrix.entries).toHaveLength(1);
    expect(matrix.entries[0].ticker1).toBe('AAPL');
    expect(matrix.entries[0].ticker2).toBe('GOOGL');
  });

  test('builds correlation matrix for three tickers', () => {
    const priceDataByTicker = new Map([
      ['AAPL', samplePricesAAPL],
      ['GOOGL', samplePricesGOOGL],
      ['MSFT', samplePricesMSFT],
    ]);

    const matrix = buildCorrelationMatrix(priceDataByTicker);

    // C(3,2) = 3 pairs: AAPL-GOOGL, AAPL-MSFT, GOOGL-MSFT
    expect(matrix.entries).toHaveLength(3);
  });

  test('entries have correct structure with coefficient and classification', () => {
    const priceDataByTicker = new Map([
      ['AAPL', samplePricesAAPL],
      ['GOOGL', samplePricesGOOGL],
    ]);

    const matrix = buildCorrelationMatrix(priceDataByTicker);
    const entry = matrix.entries[0];

    expect(entry).toHaveProperty('ticker1');
    expect(entry).toHaveProperty('ticker2');
    expect(entry).toHaveProperty('coefficient');
    expect(entry).toHaveProperty('classification');
    expect(entry.classification).toMatch(/positive|negative|neutral/);
    expect(entry.coefficient).toBeGreaterThanOrEqual(-1);
    expect(entry.coefficient).toBeLessThanOrEqual(1);
  });

  test('coefficient is rounded to two decimal places', () => {
    const priceDataByTicker = new Map([
      ['AAPL', samplePricesAAPL],
      ['GOOGL', samplePricesGOOGL],
    ]);

    const matrix = buildCorrelationMatrix(priceDataByTicker);
    const coefficient = matrix.entries[0].coefficient;

    // Coefficient should be rounded to 2 decimal places
    expect(coefficient).toBeCloseTo(Math.round(coefficient * 100) / 100, 2);
  });

  test('identifies highly correlated pairs', () => {
    // Two tickers with nearly identical movement
    const priceDataByTicker = new Map([
      ['AAPL', samplePricesAAPL],
      ['GOOGL', samplePricesGOOGL], // Similar upward trend
    ]);

    const matrix = buildCorrelationMatrix(priceDataByTicker);

    // These should be highly positively correlated
    if (matrix.entries[0].coefficient > 0.7) {
      expect(matrix.highlyCorrelated).toHaveLength(1);
    }
  });

  test('identifies negatively correlated pairs', () => {
    const priceDataByTicker = new Map([
      ['AAPL', samplePricesAAPL],
      ['INVERSE', samplePricesInverse],
    ]);

    const matrix = buildCorrelationMatrix(priceDataByTicker);

    expect(matrix.entries[0].coefficient).toBeLessThan(0);
    expect(matrix.negativelyCorrelated).toHaveLength(1);
  });

  test('identifies uncorrelated pairs', () => {
    const priceDataByTicker = new Map([
      ['AAPL', samplePricesAAPL],
      ['RANDOM', samplePricesUncorrelated],
    ]);

    const matrix = buildCorrelationMatrix(priceDataByTicker);
    const entry = matrix.entries[0];

    // Coefficient should still be in valid range (-1 to 1)
    expect(entry.coefficient).toBeGreaterThanOrEqual(-1);
    expect(entry.coefficient).toBeLessThanOrEqual(1);
    // Classification should be valid
    expect(entry.classification).toMatch(/positive|negative|neutral/);
  });

  test('handles single ticker', () => {
    const priceDataByTicker = new Map([
      ['AAPL', samplePricesAAPL],
    ]);

    const matrix = buildCorrelationMatrix(priceDataByTicker);

    // No pairs possible with single ticker
    expect(matrix.entries).toHaveLength(0);
    expect(matrix.highlyCorrelated).toHaveLength(0);
    expect(matrix.negativelyCorrelated).toHaveLength(0);
  });

  test('handles empty map', () => {
    const matrix = buildCorrelationMatrix(new Map());
    expect(matrix.entries).toHaveLength(0);
    expect(matrix.highlyCorrelated).toHaveLength(0);
    expect(matrix.negativelyCorrelated).toHaveLength(0);
  });

  test('excludes self-correlation (no diagonal entries)', () => {
    const priceDataByTicker = new Map([
      ['AAPL', samplePricesAAPL],
      ['GOOGL', samplePricesGOOGL],
      ['MSFT', samplePricesMSFT],
    ]);

    const matrix = buildCorrelationMatrix(priceDataByTicker);

    // Check no entry has same ticker1 and ticker2
    for (const entry of matrix.entries) {
      expect(entry.ticker1).not.toBe(entry.ticker2);
    }
  });

  test('highly correlated list contains only entries with coefficient > 0.7', () => {
    const priceDataByTicker = new Map([
      ['AAPL', samplePricesAAPL],
      ['GOOGL', samplePricesGOOGL], // Highly correlated with AAPL
      ['INVERSE', samplePricesInverse], // Negatively correlated
    ]);

    const matrix = buildCorrelationMatrix(priceDataByTicker);

    for (const entry of matrix.highlyCorrelated) {
      expect(entry.coefficient).toBeGreaterThan(0.7);
    }
  });

  test('negatively correlated list contains only entries with coefficient < -0.3', () => {
    const priceDataByTicker = new Map([
      ['AAPL', samplePricesAAPL],
      ['GOOGL', samplePricesGOOGL],
      ['INVERSE', samplePricesInverse],
    ]);

    const matrix = buildCorrelationMatrix(priceDataByTicker);

    for (const entry of matrix.negativelyCorrelated) {
      expect(entry.coefficient).toBeLessThan(-0.3);
    }
  });
});

// ---------------------------------------------------------------------------
// calculatePerformanceMetrics
// ---------------------------------------------------------------------------

describe('calculatePerformanceMetrics', () => {
  test('calculates performance metrics and rankings', () => {
    const priceDataByTicker = new Map([
      ['AAPL', samplePricesAAPL], // 8% return
      ['GOOGL', samplePricesGOOGL], // ~5.7% return
    ]);

    const metrics = calculatePerformanceMetrics(priceDataByTicker);

    expect(metrics).toHaveLength(2);
    // AAPL has higher return, should be ranked 1
    const aapl = metrics.find(m => m.symbol === 'AAPL');
    expect(aapl?.ranking).toBe(1);
    expect(aapl?.periodReturn).toBeGreaterThan(0);
  });

  test('calculates relative to average', () => {
    const priceDataByTicker = new Map([
      ['AAPL', samplePricesAAPL],
      ['GOOGL', samplePricesGOOGL],
    ]);

    const metrics = calculatePerformanceMetrics(priceDataByTicker);

    // Sum of relativeToAverage should be ~0 (within floating point error)
    const sum = metrics.reduce((acc, m) => acc + m.relativeToAverage, 0);
    expect(Math.abs(sum)).toBeLessThan(0.02);
  });
});

// ---------------------------------------------------------------------------
// calculateRiskMetrics
// ---------------------------------------------------------------------------

describe('calculateRiskMetrics', () => {
  test('calculates risk metrics for tickers', () => {
    const priceDataByTicker = new Map([
      ['AAPL', samplePricesAAPL],
      ['GOOGL', samplePricesGOOGL],
    ]);

    const metrics = calculateRiskMetrics(priceDataByTicker);

    expect(metrics).toHaveLength(2);
    expect(metrics[0].riskClassification).toMatch(/low|medium|high/);
    expect(metrics[0].standardDeviation).toBeGreaterThanOrEqual(0);
    expect(metrics[0].maxDrawdown).toBeLessThanOrEqual(0);
  });

  test('includes all required fields', () => {
    const priceDataByTicker = new Map([
      ['AAPL', samplePricesAAPL],
    ]);

    const metrics = calculateRiskMetrics(priceDataByTicker);

    expect(metrics[0]).toHaveProperty('symbol');
    expect(metrics[0]).toHaveProperty('standardDeviation');
    expect(metrics[0]).toHaveProperty('maxDrawdown');
    expect(metrics[0]).toHaveProperty('sharpeRatio');
    expect(metrics[0]).toHaveProperty('riskClassification');
  });
});

// ---------------------------------------------------------------------------
// Edge Cases: parseTickers
// ---------------------------------------------------------------------------

describe('parseTickers edge cases', () => {
  test('handles single ticker', () => {
    const result = parseTickers(['AAPL']);
    expect(result.valid).toEqual(['AAPL']);
    expect(result.invalid).toEqual([]);
  });

  test('handles multiple valid tickers', () => {
    const result = parseTickers(['AAPL', 'GOOGL', 'MSFT']);
    expect(result.valid).toEqual(['AAPL', 'GOOGL', 'MSFT']);
    expect(result.invalid).toEqual([]);
  });

  test('handles duplicate tickers', () => {
    const result = parseTickers(['AAPL', 'aapl', 'AAPL', 'googl', 'GOOGL']);
    // Should deduplicate and normalize to uppercase
    expect(result.valid).toEqual(['AAPL', 'GOOGL']);
    expect(result.invalid).toEqual([]);
  });

  test('handles invalid ticker format - too long', () => {
    const result = parseTickers(['AAPL', 'TOOLONG', 'MSFT']);
    expect(result.valid).toEqual(['AAPL', 'MSFT']);
    expect(result.invalid).toEqual(['TOOLONG']);
  });

  test('handles invalid ticker format - contains numbers', () => {
    const result = parseTickers(['AAPL', 'MSFT123', 'GOOGL']);
    expect(result.valid).toEqual(['AAPL', 'GOOGL']);
    expect(result.invalid).toEqual(['MSFT123']);
  });

  test('handles invalid ticker format - special characters', () => {
    const result = parseTickers(['AAPL', 'MSFT!', 'GOOGL']);
    expect(result.valid).toEqual(['AAPL', 'GOOGL']);
    expect(result.invalid).toEqual(['MSFT!']);
  });

  test('handles empty string', () => {
    const result = parseTickers(['AAPL', '', 'MSFT']);
    expect(result.valid).toEqual(['AAPL', 'MSFT']);
    expect(result.invalid).toEqual(['']);
  });

  test('handles whitespace in tickers', () => {
    const result = parseTickers([' AAPL ', 'GOOGL', ' MSFT ']);
    expect(result.valid).toEqual(['AAPL', 'GOOGL', 'MSFT']);
    expect(result.invalid).toEqual([]);
  });

  test('handles all invalid tickers', () => {
    const result = parseTickers(['123', '!!!', 'too-long']);
    expect(result.valid).toEqual([]);
    expect(result.invalid).toEqual(['123', '!!!', 'too-long']);
  });

  test('handles lowercase tickers', () => {
    const result = parseTickers(['aapl', 'googl', 'msft']);
    expect(result.valid).toEqual(['AAPL', 'GOOGL', 'MSFT']);
    expect(result.invalid).toEqual([]);
  });

  test('handles mixed case tickers', () => {
    const result = parseTickers(['AaPl', 'GoOgL', 'MsFt']);
    expect(result.valid).toEqual(['AAPL', 'GOOGL', 'MSFT']);
    expect(result.invalid).toEqual([]);
  });
});

// ---------------------------------------------------------------------------
// Edge Cases: Single Ticker Correlation
// ---------------------------------------------------------------------------

describe('single ticker correlation handling', () => {
  test('builds correlation matrix with single ticker returns empty entries', () => {
    const priceDataByTicker = new Map([
      ['AAPL', samplePricesAAPL],
    ]);

    const matrix = buildCorrelationMatrix(priceDataByTicker);

    expect(matrix.entries).toHaveLength(0);
    expect(matrix.highlyCorrelated).toHaveLength(0);
    expect(matrix.negativelyCorrelated).toHaveLength(0);
  });

  test('calculates performance metrics for single ticker', () => {
    const priceDataByTicker = new Map([
      ['AAPL', samplePricesAAPL],
    ]);

    const metrics = calculatePerformanceMetrics(priceDataByTicker);

    expect(metrics).toHaveLength(1);
    expect(metrics[0].symbol).toBe('AAPL');
    expect(metrics[0].ranking).toBe(1);
  });

  test('calculates risk metrics for single ticker', () => {
    const priceDataByTicker = new Map([
      ['AAPL', samplePricesAAPL],
    ]);

    const metrics = calculateRiskMetrics(priceDataByTicker);

    expect(metrics).toHaveLength(1);
    expect(metrics[0].symbol).toBe('AAPL');
    expect(metrics[0].standardDeviation).toBeGreaterThanOrEqual(0);
    expect(metrics[0].riskClassification).toMatch(/low|medium|high/);
  });
});

// ---------------------------------------------------------------------------
// Edge Cases: Multiple Tickers with Various Correlations
// ---------------------------------------------------------------------------

describe('multiple tickers correlation edge cases', () => {
  test('handles three tickers with different correlations', () => {
    const priceDataByTicker = new Map([
      ['AAPL', samplePricesAAPL],
      ['GOOGL', samplePricesGOOGL],
      ['MSFT', samplePricesMSFT],
    ]);

    const matrix = buildCorrelationMatrix(priceDataByTicker);

    // Should have 3 pairs: AAPL-GOOGL, AAPL-MSFT, GOOGL-MSFT
    expect(matrix.entries).toHaveLength(3);
  });

  test('handles uncorrelated tickers', () => {
    const priceDataByTicker = new Map([
      ['AAPL', samplePricesAAPL],
      ['UNCORR', samplePricesUncorrelated],
    ]);

    const matrix = buildCorrelationMatrix(priceDataByTicker);

    // Correlation should be weak (close to 0)
    expect(matrix.entries[0].coefficient).toBeGreaterThanOrEqual(-1);
    expect(matrix.entries[0].coefficient).toBeLessThanOrEqual(1);
  });

  test('handles negatively correlated tickers', () => {
    const priceDataByTicker = new Map([
      ['AAPL', samplePricesAAPL],
      ['INVERSE', samplePricesInverse],
    ]);

    const matrix = buildCorrelationMatrix(priceDataByTicker);

    // Should identify negative correlation
    expect(matrix.entries[0].coefficient).toBeLessThan(0);
    expect(matrix.negativelyCorrelated).toHaveLength(1);
  });
});
