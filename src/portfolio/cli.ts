/**
 * Portfolio CLI Module
 * Command-line interface for portfolio analysis
 */

import { parseTickerList, parseWeights } from './parser.js';
import { analyzePortfolio } from './index.js';
import type { PortfolioCLIOptions } from './types.js';

/**
 * Portfolio command help text
 */
export const PORTFOLIO_HELP = `
Portfolio Analysis Command

Analyzes multiple stock tickers as a portfolio, providing:
- Relative performance metrics
- Risk metrics (volatility, Sharpe ratio, beta)
- Correlation analysis

Usage:
  dexter portfolio <tickers> [options]

Arguments:
  <tickers>    Stock ticker symbols (space, comma, or newline separated)

Options:
  -p, --period <period>    Time period for analysis (default: 1y)
                          Valid values: 1m, 3m, 6m, 1y, ytd
  --benchmark <ticker>    Benchmark ticker for beta calculation (default: ^GSPC)
  --weights <weights>     Comma-separated portfolio weights (must sum to 1)
  --json                  Output results as JSON
  --export <format>       Export format: csv, pdf
  -h, --help              Show this help message

Examples:
  dexter portfolio AAPL GOOGL MSFT
  dexter portfolio AAPL GOOGL --period 6m
  dexter portfolio AAPL GOOGL MSFT --json
  dexter portfolio AAPL GOOGL MSFT --weights 0.5,0.3,0.2
  dexter portfolio AAPL GOOGL --benchmark ^DJI
`;

/**
 * Parse portfolio command arguments
 */
export function parsePortfolioArgs(args: string[]): {
  options: PortfolioCLIOptions;
  tickers: string[];
} {
  const options: Partial<PortfolioCLIOptions> = {
    period: '1y',
    benchmark: '^GSPC',
    json: false,
  };
  const tickers: string[] = [];

  // Simple argument parsing
  for (let i = 0; i < args.length; i++) {
    const arg = args[i];

    if (arg === '--help' || arg === '-h') {
      console.log(PORTFOLIO_HELP);
      process.exit(0);
    }

    if (arg === '--json') {
      options.json = true;
      continue;
    }

    if (arg === '-p' || arg === '--period') {
      const period = args[++i];
      if (period && ['1m', '3m', '6m', '1y', 'ytd'].includes(period)) {
        options.period = period as PortfolioCLIOptions['period'];
      }
      continue;
    }

    if (arg === '--benchmark') {
      options.benchmark = args[++i] || '^GSPC';
      continue;
    }

    if (arg === '--weights') {
      options.weights = parseWeights(args[++i]);
      continue;
    }

    if (arg === '--export') {
      const format = args[++i];
      if (format === 'csv' || format === 'pdf') {
        options.export = format;
      }
      continue;
    }

    // Treat as ticker
    if (!arg.startsWith('-')) {
      const parsed = parseTickerList(arg);
      tickers.push(...parsed);
    }
  }

  // If tickers are in separate args
  const remainingArgs = args.filter(
    a => !a.startsWith('-') && !['--json', '-p', '--period', '--benchmark', '--weights', '--export'].includes(a)
  );

  for (const arg of remainingArgs) {
    if (!tickers.includes(arg.toUpperCase())) {
      const parsed = parseTickerList(arg);
      tickers.push(...parsed);
    }
  }

  return {
    options: {
      tickers,
      period: options.period || '1y',
      benchmark: options.benchmark || '^GSPC',
      weights: options.weights,
      json: options.json || false,
      export: options.export,
    },
    tickers,
  };
}

/**
 * Execute portfolio command
 */
export async function runPortfolioCommand(args: string[]): Promise<void> {
  const { options, tickers } = parsePortfolioArgs(args);

  // Validate we have tickers
  if (tickers.length < 2) {
    console.error('Error: At least 2 tickers required for portfolio analysis');
    console.error('Usage: dexter portfolio <ticker1> <ticker2> [...tickers]');
    console.error(`Run 'dexter portfolio --help' for more information`);
    process.exit(1);
  }

  if (tickers.length > 50) {
    console.error('Error: Maximum 50 tickers allowed');
    process.exit(1);
  }

  try {
    // Show progress for human-readable output
    if (!options.json) {
      console.log(`Analyzing portfolio: ${tickers.join(', ')}`);
      console.log(`Period: ${options.period}, Benchmark: ${options.benchmark}`);
      console.log('');
    }

    const { output } = await analyzePortfolio({
      ...options,
      tickers,
    });

    console.log(output);
  } catch (error) {
    console.error('Error:', (error as Error).message);
    process.exit(1);
  }
}
