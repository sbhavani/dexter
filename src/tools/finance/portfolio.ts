import { DynamicStructuredTool } from '@langchain/core/tools';
import { z } from 'zod';
import { callApi } from './api.js';
import { formatToolResult } from '../types.js';

const PortfolioAnalysisInputSchema = z.object({
  tickers: z
    .array(z.string())
    .min(2)
    .describe('Array of stock ticker symbols to analyze (minimum 2 required)'),
  start_date: z
    .string()
    .describe('Start date in YYYY-MM-DD format. Must be in past. Recommended: at least 1 year for meaningful analysis.'),
  end_date: z
    .string()
    .describe('End date in YYYY-MM-DD format. Must be today or in the past.'),
  interval: z
    .enum(['day', 'week', 'month'])
    .default('day')
    .describe('Price interval. Use "day" for most accurate calculations, "week" or "month" for longer periods.'),
});

interface PriceData {
  time: string;
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
}

interface TickerData {
  ticker: string;
  prices: PriceData[];
}

/**
 * Fetch historical prices for multiple tickers in parallel
 */
async function fetchPricesForTickers(
  tickers: string[],
  start_date: string,
  end_date: string,
  interval: string
): Promise<Map<string, PriceData[]>> {
  const results = await Promise.all(
    tickers.map(async (ticker) => {
      try {
        const params = {
          ticker,
          interval,
          interval_multiplier: 1,
          start_date,
          end_date,
        };
        const { data, url } = await callApi('/prices/', params, { cacheable: true });
        return { ticker, prices: (data.prices || []) as PriceData[], url, error: null };
      } catch (error) {
        return {
          ticker,
          prices: [],
          url: '',
          error: error instanceof Error ? error.message : String(error),
        };
      }
    })
  );

  const priceMap = new Map<string, PriceData[]>();
  const errors: string[] = [];

  for (const result of results) {
    if (result.error) {
      errors.push(`${result.ticker}: ${result.error}`);
    } else if (result.prices.length === 0) {
      errors.push(`${result.ticker}: No price data available`);
    } else {
      priceMap.set(result.ticker, result.prices);
    }
  }

  if (errors.length > 0 && priceMap.size === 0) {
    throw new Error(`Failed to fetch price data: ${errors.join('; ')}`);
  }

  return priceMap;
}

/**
 * Calculate daily returns from price data
 */
function calculateDailyReturns(prices: PriceData[]): number[] {
  const returns: number[] = [];
  for (let i = 1; i < prices.length; i++) {
    const dailyReturn = (prices[i].close - prices[i - 1].close) / prices[i - 1].close;
    returns.push(dailyReturn);
  }
  return returns;
}

/**
 * Calculate annualized return
 */
function calculateAnnualizedReturn(prices: PriceData[]): number {
  if (prices.length < 2) return 0;
  const startPrice = prices[0].close;
  const endPrice = prices[prices.length - 1].close;
  const totalReturn = (endPrice - startPrice) / startPrice;

  const startDate = new Date(prices[0].time);
  const endDate = new Date(prices[prices.length - 1].time);
  const days = (endDate.getTime() - startDate.getTime()) / (1000 * 60 * 60 * 24);
  const years = days / 365;

  if (years <= 0) return totalReturn;
  return Math.pow(1 + totalReturn, 1 / years) - 1;
}

/**
 * Calculate annualized volatility (standard deviation)
 */
function calculateVolatility(dailyReturns: number[]): number {
  if (dailyReturns.length < 2) return 0;
  const mean = dailyReturns.reduce((a, b) => a + b, 0) / dailyReturns.length;
  const squaredDiffs = dailyReturns.map((r) => Math.pow(r - mean, 2));
  const variance = squaredDiffs.reduce((a, b) => a + b, 0) / (dailyReturns.length - 1);
  const dailyStdDev = Math.sqrt(variance);
  return dailyStdDev * Math.sqrt(252); // Annualize
}

/**
 * Calculate maximum drawdown
 */
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

  return -maxDrawdown; // Return as negative number
}

/**
 * Calculate Sharpe ratio
 */
function calculateSharpeRatio(annualizedReturn: number, volatility: number, riskFreeRate = 0.04): number {
  if (volatility === 0) return 0;
  return (annualizedReturn - riskFreeRate) / volatility;
}

/**
 * Calculate Sortino ratio (uses downside deviation)
 */
function calculateSortinoRatio(dailyReturns: number[], annualizedReturn: number, riskFreeRate = 0.04): number {
  const downsideReturns = dailyReturns.filter((r) => r < 0);
  if (downsideReturns.length === 0) return Infinity;

  const downsideSquared = downsideReturns.map((r) => r * r);
  const downsideVariance = downsideSquared.reduce((a, b) => a + b, 0) / downsideReturns.length;
  const downsideDeviation = Math.sqrt(downsideVariance) * Math.sqrt(252);

  if (downsideDeviation === 0) return 0;
  return (annualizedReturn - riskFreeRate) / downsideDeviation;
}

/**
 * Calculate correlation matrix between tickers
 */
function calculateCorrelationMatrix(
  priceData: Map<string, PriceData[]>
): Record<string, Record<string, number>> {
  const tickers = Array.from(priceData.keys());
  const correlations: Record<string, Record<string, number>> = {};

  // Calculate daily returns for all tickers
  const returnsByTicker: Map<string, number[]> = new Map();
  for (const ticker of tickers) {
    const prices = priceData.get(ticker)!;
    returnsByTicker.set(ticker, calculateDailyReturns(prices));
  }

  for (const ticker1 of tickers) {
    correlations[ticker1] = {};
    const returns1 = returnsByTicker.get(ticker1)!;

    for (const ticker2 of tickers) {
      if (ticker1 === ticker2) {
        correlations[ticker1][ticker2] = 1.0;
        continue;
      }

      const returns2 = returnsByTicker.get(ticker2)!;

      // Align returns to same length
      const minLength = Math.min(returns1.length, returns2.length);
      const aligned1 = returns1.slice(-minLength);
      const aligned2 = returns2.slice(-minLength);

      // Calculate correlation
      const n = aligned1.length;
      if (n < 2) {
        correlations[ticker1][ticker2] = 0;
        continue;
      }

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
      if (denominator === 0) {
        correlations[ticker1][ticker2] = 0;
      } else {
        correlations[ticker1][ticker2] = numerator / denominator;
      }
    }
  }

  return correlations;
}

/**
 * Calculate performance over different periods
 */
function calculatePeriodPerformance(
  prices: PriceData[],
  periods: { name: string; days: number }[]
): Record<string, number> {
  if (prices.length < 2) return {};

  const endPrice = prices[prices.length - 1].close;
  const endDate = new Date(prices[prices.length - 1].time);
  const performance: Record<string, number> = {};

  for (const period of periods) {
    const periodStartDate = new Date(endDate);
    periodStartDate.setDate(periodStartDate.getDate() - period.days);

    // Find the closest price to the period start date
    let startPrice = prices[0].close;
    for (const price of prices) {
      const priceDate = new Date(price.time);
      if (priceDate >= periodStartDate) {
        startPrice = price.close;
        break;
      }
    }

    if (startPrice > 0) {
      performance[period.name] = ((endPrice - startPrice) / startPrice) * 100;
    }
  }

  return performance;
}

/**
 * Main portfolio analysis function
 */
function analyzePortfolio(
  priceData: Map<string, PriceData[]>,
  tickers: string[]
): {
  performance: Record<string, unknown>[];
  correlationMatrix: Record<string, Record<string, number>>;
} {
  const performance: Record<string, unknown>[] = [];
  const periodConfig = [
    { name: 'ytd', days: 0 }, // Year to date
    { name: '1m', days: 30 },
    { name: '3m', days: 90 },
    { name: '6m', days: 180 },
    { name: '1y', days: 365 },
  ];

  for (const ticker of tickers) {
    const prices = priceData.get(ticker);
    if (!prices || prices.length < 2) continue;

    const dailyReturns = calculateDailyReturns(prices);
    const annualizedReturn = calculateAnnualizedReturn(prices);
    const volatility = calculateVolatility(dailyReturns);
    const maxDrawdown = calculateMaxDrawdown(prices);
    const sharpeRatio = calculateSharpeRatio(annualizedReturn, volatility);
    const sortinoRatio = calculateSortinoRatio(dailyReturns, annualizedReturn);
    const periodPerformance = calculatePeriodPerformance(prices, periodConfig);

    // Total return
    const startPrice = prices[0].close;
    const endPrice = prices[prices.length - 1].close;
    const totalReturn = ((endPrice - startPrice) / startPrice) * 100;

    performance.push({
      ticker,
      start_date: prices[0].time.split('T')[0],
      end_date: prices[prices.length - 1].time.split('T')[0],
      start_price: startPrice,
      end_price: endPrice,
      total_return_pct: Math.round(totalReturn * 100) / 100,
      annualized_return_pct: Math.round(annualizedReturn * 10000) / 100,
      volatility_pct: Math.round(volatility * 10000) / 100,
      max_drawdown_pct: Math.round(maxDrawdown * 10000) / 100,
      sharpe_ratio: Math.round(sharpeRatio * 100) / 100,
      sortino_ratio: Math.round(sortinoRatio * 100) / 100,
      period_performance: periodPerformance,
      data_points: prices.length,
    });
  }

  // Sort by total return descending
  performance.sort((a, b) => (b as any).total_return_pct - (a as any).total_return_pct);

  // Calculate correlation matrix
  const correlationMatrix = calculateCorrelationMatrix(priceData);

  return { performance, correlationMatrix };
}

export const portfolioAnalysis = new DynamicStructuredTool({
  name: 'portfolio_analysis',
  description: `Performs comparative portfolio analysis across multiple stock tickers. Calculates:
- Relative performance metrics (total return, annualized return, period performance)
- Risk metrics (volatility, max drawdown, Sharpe ratio, Sortino ratio)
- Correlation coefficients between all ticker pairs

Use this tool when comparing multiple stocks, analyzing portfolio diversification, or assessing risk-adjusted returns. Requires at least 2 tickers and recommends at least 1 year of historical data for meaningful analysis.`,
  schema: PortfolioAnalysisInputSchema,
  func: async (input) => {
    try {
      const { tickers, start_date, end_date, interval } = input;

      // Fetch prices for all tickers
      const priceData = await fetchPricesForTickers(tickers, start_date, end_date, interval);

      // Check if we have enough data
      const validTickers = Array.from(priceData.keys());
      if (validTickers.length < 2) {
        return formatToolResult(
          { error: 'Need at least 2 tickers with valid price data to perform portfolio analysis' },
          []
        );
      }

      // Perform analysis
      const { performance, correlationMatrix } = analyzePortfolio(priceData, validTickers);

      // Build summary statistics
      const summary = {
        analyzed_tickers: validTickers,
        analysis_period: {
          start_date,
          end_date,
          interval,
        },
        performance,
        correlations: correlationMatrix,
        top_performer: performance.length > 0 ? (performance[0] as any).ticker : null,
        lowest_volatility:
          performance.length > 0
            ? performance.reduce((lowest, curr) =>
                (curr as any).volatility_pct < (lowest as any).volatility_pct ? curr : lowest
              )
            : null,
        best_sharpe:
          performance.length > 0
            ? performance.reduce((best, curr) =>
                (curr as any).sharpe_ratio > (best as any).sharpe_ratio ? curr : best
              )
            : null,
      };

      return formatToolResult(summary, []);
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      return formatToolResult({ error: `Portfolio analysis failed: ${message}` }, []);
    }
  },
});
