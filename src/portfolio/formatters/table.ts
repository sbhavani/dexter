/**
 * Table Formatter
 * Human-readable table output for portfolio analysis
 */

import type {
  PortfolioAnalysis,
  PerformanceMetrics,
  RiskMetrics,
  CorrelationData,
} from '../types.js';

/**
 * Format portfolio analysis as human-readable text
 */
export function formatPortfolioTable(analysis: PortfolioAnalysis): string {
  const lines: string[] = [];

  // Header
  lines.push('');
  lines.push('═══════════════════════════════════════════════════════════════');
  lines.push(`           PORTFOLIO ANALYSIS: ${analysis.portfolio.tickers.join(', ')}`);
  lines.push('═══════════════════════════════════════════════════════════════');
  lines.push(`Period: ${analysis.portfolio.period} (${analysis.portfolio.dateRange.start} to ${analysis.portfolio.dateRange.end})`);
  lines.push('');

  // Performance Section
  lines.push('─────────────────────────────────────────────────────────────────');
  lines.push('                        PERFORMANCE');
  lines.push('─────────────────────────────────────────────────────────────────');
  lines.push('');
  lines.push('Rank | Ticker | Total Return | Annualized | Contribution');
  lines.push('-----|--------|---------------|------------|-------------');

  for (const perf of analysis.performance) {
    const rank = String(perf.ranking).padStart(3);
    const ticker = perf.ticker.padEnd(6);
    const totalReturn = formatPercent(perf.totalReturn).padStart(11);
    const annualized = formatPercent(perf.annualizedReturn).padStart(10);
    const contribution = formatPercent(perf.contribution).padStart(11);
    lines.push(`  ${rank} | ${ticker} |${totalReturn} |${annualized} |${contribution}`);
  }

  lines.push('');

  // Risk Section
  lines.push('─────────────────────────────────────────────────────────────────');
  lines.push('                          RISK');
  lines.push('─────────────────────────────────────────────────────────────────');
  lines.push('');
  lines.push('Ticker | Volatility | Sharpe  | Beta');
  lines.push('-------|------------|---------|------');

  for (const risk of analysis.risk) {
    const ticker = risk.ticker.padEnd(6);
    const volatility = formatPercent(risk.volatility).padStart(10);
    const sharpe = risk.sharpeRatio.toFixed(2).padStart(7);
    const beta = risk.beta.toFixed(2).padStart(5);
    lines.push(` ${ticker} |${volatility} | ${sharpe} | ${beta}`);
  }

  lines.push('');
  lines.push(`Portfolio Risk:`);
  lines.push(`  Volatility: ${formatPercent(analysis.portfolioRisk.volatility)}`);
  lines.push(`  Sharpe Ratio: ${analysis.portfolioRisk.sharpeRatio.toFixed(2)}`);
  lines.push(`  Value at Risk (${(analysis.portfolioRisk.confidenceLevel * 100).toFixed(0)}%): ${formatPercent(analysis.portfolioRisk.valueAtRisk)}`);
  lines.push('');

  // Correlation Section
  lines.push('─────────────────────────────────────────────────────────────────');
  lines.push('                       CORRELATION');
  lines.push('─────────────────────────────────────────────────────────────────');

  // Correlation Matrix
  lines.push('');
  lines.push('Correlation Matrix:');
  lines.push(formatCorrelationMatrix(analysis.correlation));

  // High/Low Correlations
  if (analysis.correlation.highCorrelations.length > 0) {
    lines.push('');
    lines.push('High Correlations (>0.7 - potential lack of diversification):');
    for (const [t1, t2, corr] of analysis.correlation.highCorrelations) {
      lines.push(`  ${t1} ↔ ${t2}: ${corr.toFixed(2)}`);
    }
  }

  if (analysis.correlation.lowCorrelations.length > 0) {
    lines.push('');
    lines.push('Low Correlations (<0.3 - diversification benefit):');
    for (const [t1, t2, corr] of analysis.correlation.lowCorrelations.slice(0, 5)) {
      lines.push(`  ${t1} ↔ ${t2}: ${corr.toFixed(2)}`);
    }
    if (analysis.correlation.lowCorrelations.length > 5) {
      lines.push(`  ... and ${analysis.correlation.lowCorrelations.length - 5} more`);
    }
  }

  lines.push('');
  lines.push('═══════════════════════════════════════════════════════════════');
  lines.push(`Calculated: ${analysis.metadata.calculatedAt}`);
  lines.push(`Data points: ${analysis.metadata.dataPoints} days`);
  lines.push(`Risk-free rate: ${analysis.metadata.riskFreeRate}%`);
  lines.push('═══════════════════════════════════════════════════════════════');
  lines.push('');

  return lines.join('\n');
}

/**
 * Format correlation matrix as table
 */
function formatCorrelationMatrix(correlation: CorrelationData): string {
  const { matrix, tickers } = correlation;
  const lines: string[] = [];

  // Header row
  const header = ['       ', ...tickers.map(t => t.substring(0, 6).padStart(6))].join(' ');
  lines.push(header);

  // Data rows
  for (let i = 0; i < tickers.length; i++) {
    const row = [tickers[i].substring(0, 6).padStart(6)];
    for (let j = 0; j < tickers.length; j++) {
      row.push(matrix[i][j].toFixed(2).padStart(6));
    }
    lines.push(row.join(' '));
  }

  return lines.join('\n');
}

/**
 * Format number as percentage
 */
function formatPercent(value: number): string {
  const sign = value >= 0 ? '+' : '';
  return `${sign}${value.toFixed(2)}%`;
}

/**
 * Format performance ranking section
 */
export function formatPerformanceRanking(performance: PerformanceMetrics[]): string {
  const lines: string[] = [];

  lines.push('Performance Ranking:');
  for (const perf of performance) {
    const returnStr = formatPercent(perf.totalReturn);
    lines.push(`  ${perf.ranking}. ${perf.ticker}: ${returnStr}`);
  }

  return lines.join('\n');
}

/**
 * Format risk summary
 */
export function formatRiskSummary(risk: RiskMetrics[]): string {
  const lines: string[] = [];

  lines.push('Risk Metrics:');
  lines.push('Ticker    | Volatility | Sharpe | Beta');
  lines.push('----------|------------|--------|------');

  for (const r of risk) {
    lines.push(
      `${r.ticker.padEnd(8)} | ${formatPercent(r.volatility).padStart(10)} | ` +
      `${r.sharpeRatio.toFixed(2).padStart(6)} | ${r.beta.toFixed(2)}`
    );
  }

  return lines.join('\n');
}
