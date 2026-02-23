/**
 * Price Data Aggregation Service
 * Fetches and aggregates price data for multiple tickers
 */
import type { PriceData, StockTicker, ValidationError, APIError } from './types.js';

const DEFAULT_RETRIES = 3;
const RETRY_DELAY_MS = 1000;
const MIN_DATA_POINTS = 30;

// Default benchmark symbol (S&P 500)
export const DEFAULT_BENCHMARK = '^GSPC';

/**
 * Fetch prices for a single ticker with retry logic
 */
async function fetchPricesWithRetry(
  ticker: string,
  startDate: string,
  endDate: string,
  retries = DEFAULT_RETRIES
): Promise<PriceData[]> {
  let lastError: Error | null = null;

  for (let attempt = 0; attempt < retries; attempt++) {
    try {
      const result = await fetch(
        `/api/prices/?ticker=${encodeURIComponent(ticker)}&interval=day&start_date=${startDate}&end_date=${endDate}`
      );

      if (!result.ok) {
        throw new Error(`HTTP ${result.status}: ${result.statusText}`);
      }

      const data = await result.json();
      return data.prices || [];
    } catch (error) {
      lastError = error as Error;
      if (attempt < retries - 1) {
        await new Promise(resolve => setTimeout(resolve, RETRY_DELAY_MS * (attempt + 1)));
      }
    }
  }

  throw lastError || new Error(`Failed to fetch prices for ${ticker}`);
}

/**
 * Fetch prices for multiple tickers with rate limiting
 */
export async function fetchPricesForTickers(
  tickers: string[],
  startDate: string,
  endDate: string,
  onProgress?: (current: number, total: number) => void
): Promise<Map<string, PriceData[]>> {
  const results = new Map<string, PriceData[]>();
  const errors: string[] = [];

  for (let i = 0; i < tickers.length; i++) {
    const ticker = tickers[i];

    try {
      // Rate limiting: delay between requests
      if (i > 0) {
        await new Promise(resolve => setTimeout(resolve, 200));
      }

      const prices = await fetchPricesWithRetry(ticker, startDate, endDate);
      results.set(ticker, prices);

      onProgress?.(i + 1, tickers.length);
    } catch (error) {
      errors.push(`${ticker}: ${(error as Error).message}`);
    }
  }

  if (errors.length > 0 && results.size === 0) {
    const error: APIError = {
      error: 'API_ERROR',
      message: `Failed to fetch prices: ${errors.join('; ')}`,
    };
    throw error;
  }

  return results;
}

/**
 * Fetch benchmark data (default: S&P 500)
 * Used for relative performance comparison and beta calculation
 */
export async function fetchBenchmarkData(
  startDate: string,
  endDate: string,
  benchmark: string = DEFAULT_BENCHMARK
): Promise<PriceData[]> {
  return fetchPricesWithRetry(benchmark, startDate, endDate);
}

/**
 * Validate we have sufficient data for calculations
 */
export function validateDataSufficiency(
  priceData: Map<string, PriceData[]>
): { sufficient: boolean; warnings: string[]; errors: string[] } {
  const warnings: string[] = [];
  const errors: string[] = [];

  for (const [ticker, prices] of priceData) {
    if (prices.length < MIN_DATA_POINTS) {
      errors.push(
        `${ticker}: Only ${prices.length} days of data available, minimum ${MIN_DATA_POINTS} required`
      );
    } else if (prices.length < MIN_DATA_POINTS * 2) {
      warnings.push(
        `${ticker}: Limited data (${prices.length} days), calculations may be less reliable`);
    }
  }

  return {
    sufficient: errors.length === 0,
    warnings,
    errors,
  };
}

/**
 * Convert price data map to StockTicker array
 */
export function toStockTickers(
  priceData: Map<string, PriceData[]>
): StockTicker[] {
  const tickers: StockTicker[] = [];

  for (const [symbol, prices] of priceData) {
    if (prices.length > 0) {
      tickers.push({
        symbol,
        prices: prices.sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime()),
        currentPrice: prices[prices.length - 1]?.close,
      });
    }
  }

  return tickers;
}

/**
 * Get adjusted close prices for calculation
 */
export function getAdjustedPrices(prices: PriceData[]): number[] {
  return prices.map(p => p.adjustedClose || p.close);
}

/**
 * Convert benchmark price data to StockTicker format
 * Useful for using benchmark data with existing calculation functions
 */
export function toBenchmarkTicker(
  prices: PriceData[],
  symbol: string = DEFAULT_BENCHMARK
): StockTicker | null {
  if (prices.length === 0) {
    return null;
  }

  const sortedPrices = prices.sort(
    (a, b) => new Date(a.date).getTime() - new Date(b.date).getTime()
  );

  return {
    symbol,
    prices: sortedPrices,
    currentPrice: sortedPrices[sortedPrices.length - 1]?.close,
  };
}
