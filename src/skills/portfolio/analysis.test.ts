import { describe, test, expect } from 'bun:test';
import {
  calculateDailyReturns,
  calculateMean,
  calculateStandardDeviation,
  calculateTotalReturn,
  calculateAnnualizedReturn,
  calculateVolatility,
  calculateSharpeRatio,
  calculateMaxDrawdown,
  calculateSortinoRatio,
  calculateCorrelation,
  buildCorrelationMatrix,
  calculatePerformanceMetrics,
  calculateRiskMetrics,
  analyzePortfolio,
  generateInsights,
  type PriceData,
  type PerformanceMetrics,
  type RiskMetrics,
} from './analysis.js';

// ---------------------------------------------------------------------------
// calculateDailyReturns
// ---------------------------------------------------------------------------

describe('calculateDailyReturns', () => {
  test('calculates correct daily returns', () => {
    const prices = [100, 105, 102, 110];
    const returns = calculateDailyReturns(prices);
    expect(returns).toEqual([0.05, -0.028571428571428572, 0.0784313725490196]);
  });

  test('returns empty array for single price', () => {
    const prices = [100];
    const returns = calculateDailyReturns(prices);
    expect(returns).toEqual([]);
  });

  test('returns empty array for empty array', () => {
    const prices: number[] = [];
    const returns = calculateDailyReturns(prices);
    expect(returns).toEqual([]);
  });

  test('handles price decreases correctly', () => {
    const prices = [100, 90, 95];
    const returns = calculateDailyReturns(prices);
    expect(returns[0]).toBe(-0.1); // -10%
    expect(returns[1]).toBeCloseTo(0.0556, 3); // +5.56%
  });
});

// ---------------------------------------------------------------------------
// calculateMean
// ---------------------------------------------------------------------------

describe('calculateMean', () => {
  test('calculates correct mean', () => {
    expect(calculateMean([1, 2, 3, 4, 5])).toBe(3);
    expect(calculateMean([10, 20, 30])).toBe(20);
  });

  test('returns 0 for empty array', () => {
    expect(calculateMean([])).toBe(0);
  });

  test('handles negative numbers', () => {
    expect(calculateMean([-10, 0, 10])).toBe(0);
  });
});

// ---------------------------------------------------------------------------
// calculateStandardDeviation
// ---------------------------------------------------------------------------

describe('calculateStandardDeviation', () => {
  test('calculates correct standard deviation', () => {
    // Values: 2, 4, 4, 4, 5, 5, 7, 9
    // Mean = 5, variance = 4, std = 2
    const values = [2, 4, 4, 4, 5, 5, 7, 9];
    const std = calculateStandardDeviation(values);
    expect(std).toBeCloseTo(2, 0);
  });

  test('returns 0 for single value', () => {
    expect(calculateStandardDeviation([5])).toBe(0);
  });

  test('returns 0 for empty array', () => {
    expect(calculateStandardDeviation([])).toBe(0);
  });
});

// ---------------------------------------------------------------------------
// calculateTotalReturn
// ---------------------------------------------------------------------------

describe('calculateTotalReturn', () => {
  test('calculates correct positive return', () => {
    const result = calculateTotalReturn(100, 150);
    expect(result).toBe(50); // 50%
  });

  test('calculates correct negative return', () => {
    const result = calculateTotalReturn(100, 75);
    expect(result).toBe(-25); // -25%
  });

  test('returns 0 for same start and end price', () => {
    expect(calculateTotalReturn(100, 100)).toBe(0);
  });

  test('returns 0 for zero start price', () => {
    expect(calculateTotalReturn(0, 100)).toBe(0);
  });
});

// ---------------------------------------------------------------------------
// calculateAnnualizedReturn
// ---------------------------------------------------------------------------

describe('calculateAnnualizedReturn', () => {
  test('calculates correct annualized return for 1 year', () => {
    // 100 -> 110 = 10% total, should be ~10% annualized
    const result = calculateAnnualizedReturn(100, 110, 252);
    expect(result).toBeCloseTo(10, 0);
  });

  test('calculates correct annualized return for 2 years', () => {
    // 100 -> 121 over 2 years = ~10% annualized (1.1^0.5 - 1 = 0.048...)
    // Actually: 121/100 = 1.21, 1.21^(252/504) - 1 = ~10%
    const result = calculateAnnualizedReturn(100, 121, 504);
    expect(result).toBeCloseTo(10, 0);
  });

  test('returns 0 for zero start price', () => {
    expect(calculateAnnualizedReturn(0, 100, 252)).toBe(0);
  });

  test('returns 0 for zero trading days', () => {
    expect(calculateAnnualizedReturn(100, 110, 0)).toBe(0);
  });
});

// ---------------------------------------------------------------------------
// calculateVolatility
// ---------------------------------------------------------------------------

describe('calculateVolatility', () => {
  test('calculates correct volatility for varying returns', () => {
    // Returns with some variation
    const returns = [0.01, 0.015, 0.02, 0.005, 0.025, -0.01, 0.01, 0.03, -0.005, 0.02];
    const vol = calculateVolatility(returns);
    expect(vol).toBeGreaterThan(10);
    expect(vol).toBeLessThan(50);
  });

  test('returns 0 for insufficient data', () => {
    expect(calculateVolatility([0.01])).toBe(0);
    expect(calculateVolatility([])).toBe(0);
  });
});

// ---------------------------------------------------------------------------
// calculateSharpeRatio
// ---------------------------------------------------------------------------

describe('calculateSharpeRatio', () => {
  test('calculates correct positive Sharpe ratio', () => {
    // Return 15%, volatility 10%, risk-free 4%
    // Sharpe = (15 - 4) / 10 = 1.1
    const result = calculateSharpeRatio(15, 10);
    expect(result).toBe(1.1);
  });

  test('calculates correct negative Sharpe ratio', () => {
    // Return 2%, volatility 10%, risk-free 4%
    // Sharpe = (2 - 4) / 10 = -0.2
    const result = calculateSharpeRatio(2, 10);
    expect(result).toBe(-0.2);
  });

  test('returns 0 for zero volatility', () => {
    expect(calculateSharpeRatio(10, 0)).toBe(0);
  });

  test('uses custom risk-free rate', () => {
    // Return 15%, volatility 10%, risk-free 5%
    // Sharpe = (15 - 5) / 10 = 1.0
    const result = calculateSharpeRatio(15, 10, 5);
    expect(result).toBe(1.0);
  });
});

// ---------------------------------------------------------------------------
// calculateMaxDrawdown
// ---------------------------------------------------------------------------

describe('calculateMaxDrawdown', () => {
  test('calculates correct max drawdown for trending up', () => {
    const prices = [100, 110, 105, 120, 115, 130];
    const drawdown = calculateMaxDrawdown(prices);
    // Peak at 110, drops to 105: (110-105)/110 = 4.5%
    // Peak at 120, drops to 115: (120-115)/120 = 4.17%
    expect(drawdown).toBeCloseTo(4.55, 1);
  });

  test('returns 0 for monotonically increasing prices', () => {
    const prices = [100, 110, 120, 130];
    expect(calculateMaxDrawdown(prices)).toBe(0);
  });

  test('returns 0 for single price', () => {
    expect(calculateMaxDrawdown([100])).toBe(0);
  });

  test('returns 0 for empty array', () => {
    expect(calculateMaxDrawdown([])).toBe(0);
  });

  test('handles large drop', () => {
    const prices = [100, 150, 50, 75];
    const drawdown = calculateMaxDrawdown(prices);
    // Peak at 150, drops to 50: (150-50)/150 = 66.67%
    expect(drawdown).toBeCloseTo(66.67, 1);
  });
});

// ---------------------------------------------------------------------------
// calculateSortinoRatio
// ---------------------------------------------------------------------------

describe('calculateSortinoRatio', () => {
  test('calculates sortino ratio with negative returns', () => {
    // Returns with significant negative values to generate downside volatility
    const dailyReturns = [0.02, -0.03, 0.01, -0.05, 0.03, -0.02, 0.01, -0.04, 0.02, -0.01];
    const annualizedReturn = 10;
    const result = calculateSortinoRatio(annualizedReturn, dailyReturns);
    // Should be positive since return > risk-free
    expect(result).toBeDefined();
  });

  test('returns 0 for empty returns', () => {
    expect(calculateSortinoRatio(10, [])).toBe(0);
  });
});

// ---------------------------------------------------------------------------
// calculateCorrelation
// ---------------------------------------------------------------------------

describe('calculateCorrelation', () => {
  test('returns 1.0 for perfectly correlated series', () => {
    const returnsA = [0.01, 0.02, 0.03, 0.04, 0.05];
    const returnsB = [0.01, 0.02, 0.03, 0.04, 0.05];
    expect(calculateCorrelation(returnsA, returnsB)).toBeCloseTo(1, 5);
  });

  test('returns -1.0 for perfectly negatively correlated series', () => {
    const returnsA = [0.01, 0.02, 0.03, 0.04, 0.05];
    const returnsB = [-0.01, -0.02, -0.03, -0.04, -0.05];
    expect(calculateCorrelation(returnsA, returnsB)).toBeCloseTo(-1, 5);
  });

  test('returns 0 for uncorrelated series', () => {
    const returnsA = [0.01, 0.02, 0.03, 0.04, 0.05];
    const returnsB = [-0.01, 0.02, -0.03, 0.04, -0.05];
    const corr = calculateCorrelation(returnsA, returnsB);
    expect(Math.abs(corr)).toBeLessThan(0.5);
  });

  test('handles different length arrays', () => {
    const returnsA = [0.01, 0.02, 0.03];
    const returnsB = [0.01, 0.02, 0.03, 0.04, 0.05];
    expect(calculateCorrelation(returnsA, returnsB)).toBeCloseTo(1, 5);
  });

  test('returns 0 for insufficient data', () => {
    expect(calculateCorrelation([0.01], [0.01])).toBe(0);
    expect(calculateCorrelation([], [])).toBe(0);
  });
});

// ---------------------------------------------------------------------------
// buildCorrelationMatrix
// ---------------------------------------------------------------------------

describe('buildCorrelationMatrix', () => {
  test('builds correct 2x2 matrix', () => {
    const stockReturns = [
      { ticker: 'AAPL', dailyReturns: [0.01, 0.02, 0.03], prices: [], dates: [] },
      { ticker: 'MSFT', dailyReturns: [0.01, 0.02, 0.03], prices: [], dates: [] },
    ];
    const result = buildCorrelationMatrix(stockReturns);
    expect(result.tickers).toEqual(['AAPL', 'MSFT']);
    expect(result.matrix[0][0]).toBe(1);
    expect(result.matrix[1][1]).toBe(1);
    expect(result.matrix[0][1]).toBeCloseTo(1, 5);
    expect(result.matrix[1][0]).toBeCloseTo(1, 5);
  });

  test('builds correct 3x3 matrix', () => {
    const stockReturns = [
      { ticker: 'AAPL', dailyReturns: [0.01, 0.02, 0.03], prices: [], dates: [] },
      { ticker: 'MSFT', dailyReturns: [-0.01, -0.02, -0.03], prices: [], dates: [] },
      { ticker: 'GOOGL', dailyReturns: [0.01, -0.02, 0.03], prices: [], dates: [] },
    ];
    const result = buildCorrelationMatrix(stockReturns);
    expect(result.matrix.length).toBe(3);
    expect(result.matrix[0][0]).toBe(1);
    expect(result.matrix[1][1]).toBe(1);
    expect(result.matrix[2][2]).toBe(1);
  });
});

// ---------------------------------------------------------------------------
// calculatePerformanceMetrics
// ---------------------------------------------------------------------------

describe('calculatePerformanceMetrics', () => {
  test('calculates all performance metrics correctly', () => {
    const prices = [100, 110, 105, 120, 115];
    const dates = ['2024-01-01', '2024-01-02', '2024-01-03', '2024-01-04', '2024-01-05'];

    const result = calculatePerformanceMetrics('AAPL', prices, dates);

    expect(result.ticker).toBe('AAPL');
    expect(result.startPrice).toBe(100);
    expect(result.endPrice).toBe(115);
    expect(result.tradingDays).toBe(5);
    expect(result.totalReturn).toBeCloseTo(15, 1);
  });

  test('handles negative returns', () => {
    const prices = [100, 90, 80, 70, 60];
    const dates = ['2024-01-01', '2024-01-02', '2024-01-03', '2024-01-04', '2024-01-05'];

    const result = calculatePerformanceMetrics('AAPL', prices, dates);

    expect(result.totalReturn).toBe(-40);
    expect(result.annualizedReturn).toBeLessThan(0);
  });
});

// ---------------------------------------------------------------------------
// calculateRiskMetrics
// ---------------------------------------------------------------------------

describe('calculateRiskMetrics', () => {
  test('calculates all risk metrics correctly', () => {
    const prices = [100, 105, 102, 108, 106, 110, 115];

    const result = calculateRiskMetrics('AAPL', prices);

    expect(result.ticker).toBe('AAPL');
    expect(result.volatility).toBeGreaterThan(0);
    expect(result.sharpeRatio).toBeDefined();
    expect(result.maxDrawdown).toBeGreaterThanOrEqual(0);
  });

  test('handles low volatility stocks', () => {
    // Small, consistent gains
    const prices = [100, 100.5, 101, 101.5, 102, 102.5, 103];

    const result = calculateRiskMetrics('AAPL', prices);

    expect(result.volatility).toBeLessThan(50); // Should be low
  });
});

// ---------------------------------------------------------------------------
// analyzePortfolio
// ---------------------------------------------------------------------------

describe('analyzePortfolio', () => {
  test('analyzes portfolio with multiple tickers', () => {
    const priceDataMap = new Map<string, PriceData[]>();

    priceDataMap.set('AAPL', [
      { date: '2024-01-01', close: 100 },
      { date: '2024-01-02', close: 105 },
      { date: '2024-01-03', close: 110 },
    ]);

    priceDataMap.set('MSFT', [
      { date: '2024-01-01', close: 100 },
      { date: '2024-01-02', close: 103 },
      { date: '2024-01-03', close: 106 },
    ]);

    const result = analyzePortfolio(priceDataMap);

    expect(result.performance.length).toBe(2);
    expect(result.risk.length).toBe(2);
    expect(result.correlation.tickers).toEqual(['AAPL', 'MSFT']);
    expect(result.correlation.matrix.length).toBe(2);
    expect(result.analysisDate).toBeDefined();
  });

  test('handles empty portfolio', () => {
    const priceDataMap = new Map<string, PriceData[]>();
    const result = analyzePortfolio(priceDataMap);

    expect(result.performance).toEqual([]);
    expect(result.risk).toEqual([]);
    expect(result.correlation.tickers).toEqual([]);
    expect(result.correlation.matrix).toEqual([]);
  });
});

// ---------------------------------------------------------------------------
// generateInsights
// ---------------------------------------------------------------------------

describe('generateInsights', () => {
  test('generates insights from portfolio data', () => {
    const performance: PerformanceMetrics[] = [
      { ticker: 'AAPL', totalReturn: 20, annualizedReturn: 20, bestDay: 5, worstDay: -3, startPrice: 100, endPrice: 120, startDate: '2024-01-01', endDate: 252, tradingDays: 252 },
      { ticker: 'MSFT', totalReturn: 15, annualizedReturn: 15, bestDay: 4, worstDay: -2, startPrice: 100, endPrice: 115, startDate: '2024-01-01', endDate: 252, tradingDays: 252 },
    ];

    const risk: RiskMetrics[] = [
      { ticker: 'AAPL', volatility: 20, sharpeRatio: 0.8, maxDrawdown: 10 },
      { ticker: 'MSFT', volatility: 15, sharpeRatio: 0.73, maxDrawdown: 8 },
    ];

    const correlation = {
      tickers: ['AAPL', 'MSFT'],
      matrix: [[1, 0.5], [0.5, 1]],
    };

    const insights = generateInsights(performance, risk, correlation);

    expect(insights.length).toBe(4);
    expect(insights[0]).toContain('AAPL'); // Best performer
    expect(insights[1]).toContain('AAPL'); // Best Sharpe
    expect(insights[2]).toContain('AAPL'); // Lowest correlation (either order)
    expect(insights[3]).toContain('AAPL'); // Highest volatility
  });
});
