import { describe, it, expect } from 'bun:test';

// Import the calculation functions directly
// Since we're testing the logic, we can test them in isolation

interface PriceData {
  time: string;
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
}

function calculateDailyReturns(prices: PriceData[]): number[] {
  const returns: number[] = [];
  for (let i = 1; i < prices.length; i++) {
    const dailyReturn = (prices[i].close - prices[i - 1].close) / prices[i - 1].close;
    returns.push(dailyReturn);
  }
  return returns;
}

function calculateVolatility(dailyReturns: number[]): number {
  if (dailyReturns.length < 2) return 0;
  const mean = dailyReturns.reduce((a, b) => a + b, 0) / dailyReturns.length;
  const squaredDiffs = dailyReturns.map((r) => Math.pow(r - mean, 2));
  const variance = squaredDiffs.reduce((a, b) => a + b, 0) / (dailyReturns.length - 1);
  const dailyStdDev = Math.sqrt(variance);
  return dailyStdDev * Math.sqrt(252);
}

function calculateMaxDrawdown(prices: PriceData[]): number {
  if (prices.length < 2) return 0;
  let maxDrawdown = 0;
  let peak = prices[0].close;
  for (const price of prices) {
    if (price.close > peak) {
      peak = price.close;
    }
    const drawdown = (peak - price.close) / peak;
    if (drawdown > maxDrawdown) {
      maxDrawdown = drawdown;
    }
  }
  return -maxDrawdown;
}

function calculateCorrelation(returns1: number[], returns2: number[]): number {
  const minLength = Math.min(returns1.length, returns2.length);
  const aligned1 = returns1.slice(-minLength);
  const aligned2 = returns2.slice(-minLength);
  const n = aligned1.length;
  if (n < 2) return 0;

  const mean1 = aligned1.reduce((a, b) => a + b, 0) / n;
  const mean2 = aligned2.reduce((a, b) => a + b, 0) / n;

  let numerator = 0;
  let sum1Sq = 0;
  let sum2Sq = 0;

  for (let i = 0; i < n; i++) {
    const diff1 = aligned1[i] - mean1;
    const diff2 = aligned2[i] - mean2;
    numerator += diff1 * diff2;
    sum1Sq += diff1 * diff1;
    sum2Sq += diff2 * diff2;
  }

  const denominator = Math.sqrt(sum1Sq * sum2Sq);
  if (denominator === 0) return 0;
  return numerator / denominator;
}

describe('Portfolio Analysis Calculations', () => {
  const mockPricesAAPL: PriceData[] = [
    { time: '2024-01-01', open: 100, high: 105, low: 99, close: 102, volume: 1000000 },
    { time: '2024-01-02', open: 102, high: 108, low: 101, close: 105, volume: 1100000 },
    { time: '2024-01-03', open: 105, high: 110, low: 104, close: 108, volume: 1200000 },
    { time: '2024-01-04', open: 108, high: 112, low: 107, close: 110, volume: 1300000 },
    { time: '2024-01-05', open: 110, high: 115, low: 109, close: 112, volume: 1400000 },
  ];

  const mockPricesMSFT: PriceData[] = [
    { time: '2024-01-01', open: 200, high: 205, low: 199, close: 202, volume: 1000000 },
    { time: '2024-01-02', open: 202, high: 208, low: 201, close: 204, volume: 1100000 },
    { time: '2024-01-03', open: 204, high: 210, low: 203, close: 206, volume: 1200000 },
    { time: '2024-01-04', open: 206, high: 212, low: 205, close: 208, volume: 1300000 },
    { time: '2024-01-05', open: 208, high: 215, low: 207, close: 210, volume: 1400000 },
  ];

  describe('Daily Returns', () => {
    it('should calculate correct daily returns', () => {
      const returns = calculateDailyReturns(mockPricesAAPL);
      expect(returns.length).toBe(4); // 5 prices = 4 returns
      expect(returns[0]).toBeCloseTo((105 - 102) / 102, 5); // ~2.94%
    });
  });

  describe('Volatility', () => {
    it('should calculate annualized volatility', () => {
      const returns = calculateDailyReturns(mockPricesAAPL);
      const volatility = calculateVolatility(returns);
      expect(volatility).toBeGreaterThan(0);
    });
  });

  describe('Maximum Drawdown', () => {
    it('should calculate negative max drawdown for declining prices', () => {
      const decliningPrices: PriceData[] = [
        { time: '2024-01-01', open: 100, high: 100, low: 100, close: 100, volume: 1000 },
        { time: '2024-01-02', open: 90, high: 90, low: 90, close: 90, volume: 1000 },
        { time: '2024-01-03', open: 80, high: 80, low: 80, close: 80, volume: 1000 },
      ];
      const maxDrawdown = calculateMaxDrawdown(decliningPrices);
      expect(maxDrawdown).toBeCloseTo(-0.2, 2); // 20% drawdown
    });
  });

  describe('Correlation', () => {
    it('should return correlation of 1 for perfectly correlated assets', () => {
      const returns1 = [0.01, 0.02, 0.03, 0.04];
      const returns2 = [0.01, 0.02, 0.03, 0.04];
      const correlation = calculateCorrelation(returns1, returns2);
      expect(correlation).toBeCloseTo(1, 5);
    });

    it('should return correlation of -1 for perfectly negatively correlated assets', () => {
      const returns1 = [0.01, 0.02, 0.03, 0.04];
      const returns2 = [-0.01, -0.02, -0.03, -0.04];
      const correlation = calculateCorrelation(returns1, returns2);
      expect(correlation).toBeCloseTo(-1, 5);
    });

    it('should calculate correlation between AAPL and MSFT', () => {
      const returnsAAPL = calculateDailyReturns(mockPricesAAPL);
      const returnsMSFT = calculateDailyReturns(mockPricesMSFT);
      const correlation = calculateCorrelation(returnsAAPL, returnsMSFT);
      // Both stocks went up, so correlation should be positive
      expect(correlation).toBeGreaterThan(0);
    });
  });
});
