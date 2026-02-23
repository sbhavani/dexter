import { DynamicStructuredTool } from '@langchain/core/tools';
import { z } from 'zod';
import { getPrices } from './prices.js';
import { formatToolResult } from '../types.js';
import {
  calculatePerformanceMetrics,
  calculateRiskMetrics,
  buildCorrelationMatrix,
  PriceData,
} from '../../utils/portfolio-metrics.js';

/**
 * Valid periods for analysis
 */
const VALID_PERIODS = [30, 60, 90, 180] as const;
const DEFAULT_PERIOD = 30;

/**
 * Input schema for portfolio analysis
 */
const PortfolioAnalysisInputSchema = z.object({
  tickers: z
    .array(z.string())
    .min(1)
    .max(20)
    .describe('List of 1-20 stock ticker symbols to analyze (e.g., ["AAPL", "GOOGL", "MSFT"])'),
  period: z
    .enum([...VALID_PERIODS])
    .optional()
    .default(DEFAULT_PERIOD)
    .describe('Analysis period in days: 30, 60, 90, or 180 (default: 30)'),
});

type PortfolioAnalysisInput = z.infer<typeof PortfolioAnalysisInputSchema>;

/**
 * Parse and validate tickers
 * - Deduplicate tickers
 * - Validate format (1-5 uppercase letters)
 */
export function parseTickers(tickers: string[]): { valid: string[]; invalid: string[] } {
  const seen = new Set<string>();
  const valid: string[] = [];
  const invalid: string[] = [];

  for (const ticker of tickers) {
    const normalized = ticker.trim().toUpperCase();
    // Check format: 1-5 uppercase letters
    if (!/^[A-Z]{1,5}$/.test(normalized)) {
      invalid.push(ticker);
      continue;
    }
    // Deduplicate
    if (!seen.has(normalized)) {
      seen.add(normalized);
      valid.push(normalized);
    }
  }

  return { valid, invalid };
}

/**
 * Calculate date range for analysis
 */
function getDateRange(period: number): { startDate: string; endDate: string } {
  const endDate = new Date();
  endDate.setHours(0, 0, 0, 0);

  const startDate = new Date();
  startDate.setDate(startDate.getDate() - period);
  startDate.setHours(0, 0, 0, 0);

  return {
    startDate: startDate.toISOString().split('T')[0],
    endDate: endDate.toISOString().split('T')[0],
  };
}

/**
 * Parse price data from get_prices result
 */
function parsePriceData(result: string, ticker: string): { prices: PriceData[]; valid: boolean; error?: string } {
  try {
    const parsed = JSON.parse(result);
    if (parsed.data && Array.isArray(parsed.data) && parsed.data.length > 0) {
      return { prices: parsed.data, valid: true };
    }
    return { prices: [], valid: false, error: 'No price data available' };
  } catch {
    return { prices: [], valid: false, error: 'Failed to parse price data' };
  }
}

/**
 * Calculate data coverage percentage
 */
function calculateDataCoverage(requestedDays: number, actualDataPoints: number): number {
  // Expected roughly one data point per trading day
  const expectedPoints = Math.floor(requestedDays * 0.75); // ~75% of calendar days are trading days
  if (expectedPoints === 0) return 0;
  return Math.min(100, Math.round((actualDataPoints / expectedPoints) * 100));
}

/**
 * Create portfolio analysis tool
 * Uses factory pattern like createFinancialMetrics
 */
export function createPortfolioAnalysis(model: string): DynamicStructuredTool {
  return new DynamicStructuredTool({
    name: 'portfolio_analysis',
    description: `Analyze multiple stock tickers for comparative performance, risk metrics, and correlation. Use when:
- User wants to compare multiple stocks (e.g., "compare AAPL vs GOOGL" or "analyze my portfolio of AAPL, MSFT, TSLA")
- User asks about risk or volatility of multiple stocks
- User wants correlation analysis between assets
- Input: array of tickers and optional period (30, 60, 90, 180 days)
- Output: performance rankings, risk metrics, correlation matrix`,
    schema: PortfolioAnalysisInputSchema,
    func: async (input: PortfolioAnalysisInput) => {
      const { tickers, period } = input;

      // Step 1: Parse and validate tickers (T006, T007)
      const { valid: validTickers, invalid: invalidTickers } = parseTickers(tickers);

      const warnings: string[] = [];

      // Add warning for invalid tickers
      if (invalidTickers.length > 0) {
        warnings.push(`Invalid ticker format: ${invalidTickers.join(', ')}`);
      }

      // Handle no valid tickers
      if (validTickers.length === 0) {
        return formatToolResult({
          error: 'No valid tickers provided',
          tickers: [],
          warnings: ['All provided tickers have invalid format'],
        }, []);
      }

      // Step 2: Get date range (T014)
      const { startDate, endDate } = getDateRange(period);

      // Step 3: Fetch prices in parallel for all tickers (T003)
      const priceResults = await Promise.all(
        validTickers.map(async (ticker) => {
          try {
            const result = await getPrices.invoke({
              ticker,
              interval: 'day',
              interval_multiplier: 1,
              start_date: startDate,
              end_date: endDate,
            });
            return { ticker, result, error: null };
          } catch (error) {
            return {
              ticker,
              result: null,
              error: error instanceof Error ? error.message : String(error),
            };
          }
        })
      );

      // Step 4: Process results
      const priceDataByTicker = new Map<string, PriceData[]>();
      const tickerResults: Array<{ symbol: string; name?: string; valid: boolean }> = [];
      const sourceUrls: string[] = [];
      const dataWarnings: string[] = [];

      for (const { ticker, result, error } of priceResults) {
        if (error || !result) {
          tickerResults.push({ symbol: ticker, valid: false });
          warnings.push(`Failed to fetch data for ${ticker}: ${error || 'Unknown error'}`);
          continue;
        }

        // Extract source URL from result
        try {
          const parsed = JSON.parse(result);
          if (parsed.sourceUrls && parsed.sourceUrls[0]) {
            sourceUrls.push(parsed.sourceUrls[0]);
          }
        } catch {
          // Ignore parse errors for source URL
        }

        const { prices, valid, error: parseError } = parsePriceData(result, ticker);

        if (!valid || prices.length === 0) {
          tickerResults.push({ symbol: ticker, valid: false });
          warnings.push(`No data available for ${ticker}: ${parseError || 'Empty data'}`);
          continue;
        }

        // Check data coverage (T016)
        const coverage = calculateDataCoverage(period, prices.length);
        if (coverage < 90) {
          dataWarnings.push(`${ticker}: Only ${coverage}% data coverage (${prices.length} points)`);
        }

        priceDataByTicker.set(ticker, prices);
        tickerResults.push({ symbol: ticker, valid: true });
      }

      // Add data quality warnings (T016)
      if (dataWarnings.length > 0) {
        warnings.push(...dataWarnings);
      }

      // Handle no valid data
      if (priceDataByTicker.size === 0) {
        return formatToolResult({
          error: 'No valid price data retrieved for any ticker',
          tickers: tickerResults,
          warnings,
        }, sourceUrls);
      }

      // Step 5: Calculate performance metrics (T004)
      const performanceMetrics = calculatePerformanceMetrics(priceDataByTicker);

      // Step 6: Calculate risk metrics (T005)
      const riskMetrics = calculateRiskMetrics(priceDataByTicker);

      // Step 7: Calculate correlation matrix (T011, T012)
      let correlation: Record<string, unknown> | null = null;
      let concentrationRisk: string[] = [];

      if (priceDataByTicker.size >= 2) {
        const correlationMatrix = buildCorrelationMatrix(priceDataByTicker);
        correlation = {
          entries: correlationMatrix.entries,
          highlyCorrelated: correlationMatrix.highlyCorrelated,
          negativelyCorrelated: correlationMatrix.negativelyCorrelated,
        };

        // Identify concentration risk (T017)
        if (correlationMatrix.highlyCorrelated.length > 0) {
          concentrationRisk.push(
            `${correlationMatrix.highlyCorrelated.length} ticker pair(s) are highly correlated (>0.7) - consider diversification`
          );
        }
        // If most correlations are high positive, suggest diversification
        const positiveCount = correlationMatrix.entries.filter(e => e.classification === 'positive').length;
        if (positiveCount / correlationMatrix.entries.length > 0.8) {
          concentrationRisk.push('Most assets are positively correlated - portfolio may lack diversification');
        }
      } else if (priceDataByTicker.size === 1) {
        // Handle single ticker case (T013)
        correlation = {
          entries: [],
          highlyCorrelated: [],
          negativelyCorrelated: [],
          note: 'Correlation analysis requires at least 2 tickers',
        };
      }

      // Build final result
      const result = {
        tickers: tickerResults,
        performance: performanceMetrics,
        risk: riskMetrics,
        correlation,
        concentrationRisk: concentrationRisk.length > 0 ? concentrationRisk : undefined,
        metadata: {
          period,
          startDate,
          endDate,
          dataCoverage: Math.min(100, Math.round(
            (Array.from(priceDataByTicker.values()).reduce((sum, p) => sum + p.length, 0) /
            (priceDataByTicker.size * period * 0.75)) * 100
          )),
          warnings: warnings.length > 0 ? warnings : undefined,
        },
      };

      return formatToolResult(result, sourceUrls);
    },
  });
}
