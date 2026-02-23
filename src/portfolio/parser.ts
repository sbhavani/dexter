/**
 * Ticker List Parser
 * Parses various ticker input formats (comma, space, newline separated)
 */

/**
 * Parse ticker input string into array of normalized tickers
 * Supports: "AAPL,GOOGL,MSFT", "AAPL GOOGL MSFT", "AAPL\nGOOGL\nMSFT"
 */
export function parseTickerList(input: string): string[] {
  if (!input || typeof input !== 'string') {
    return [];
  }

  // Split by common separators: comma, space, newline, tab, semicolon
  const tickers = input
    .split(/[,\s\n\t;]+/)
    .map(t => t.trim().toUpperCase())
    .filter(t => t.length > 0);

  // Remove duplicates while preserving order
  const seen = new Set<string>();
  const unique: string[] = [];
  for (const ticker of tickers) {
    if (!seen.has(ticker)) {
      seen.add(ticker);
      unique.push(ticker);
    }
  }

  return unique;
}

/**
 * Parse comma-separated string
 */
export function parseCommaSeparated(input: string): string[] {
  return input
    .split(',')
    .map(t => t.trim().toUpperCase())
    .filter(t => t.length > 0);
}

/**
 * Parse weights from comma-separated string
 */
export function parseWeights(input?: string): number[] | undefined {
  if (!input) {
    return undefined;
  }

  const weights = input
    .split(',')
    .map(w => parseFloat(w.trim()))
    .filter(w => !isNaN(w));

  return weights.length > 0 ? weights : undefined;
}

/**
 * Parse period string to date range
 */
export function parsePeriod(period: string): { startDate: string; endDate: string } {
  const endDate = new Date();
  endDate.setHours(0, 0, 0, 0);
  const end = endDate.toISOString().split('T')[0];

  const startDate = new Date();
  startDate.setHours(0, 0, 0, 0);

  switch (period) {
    case '1m':
      startDate.setMonth(startDate.getMonth() - 1);
      break;
    case '3m':
      startDate.setMonth(startDate.getMonth() - 3);
      break;
    case '6m':
      startDate.setMonth(startDate.getMonth() - 6);
      break;
    case '1y':
      startDate.setFullYear(startDate.getFullYear() - 1);
      break;
    case 'ytd':
      startDate.setMonth(0, 1); // January 1st of current year
      if (startDate > new Date()) {
        startDate.setFullYear(startDate.getFullYear() - 1);
      }
      break;
    default:
      startDate.setFullYear(startDate.getFullYear() - 1);
  }

  return {
    startDate: startDate.toISOString().split('T')[0],
    endDate: end,
  };
}
