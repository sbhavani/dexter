/**
 * JSON Formatter
 * JSON output for portfolio analysis
 */

import type { PortfolioAnalysis } from '../types.js';

/**
 * Format portfolio analysis as JSON
 */
export function formatPortfolioJSON(analysis: PortfolioAnalysis): string {
  return JSON.stringify(analysis, null, 2);
}

/**
 * Format portfolio analysis as compact JSON (no whitespace)
 */
export function formatPortfolioJSONCompact(analysis: PortfolioAnalysis): string {
  return JSON.stringify(analysis);
}

/**
 * Parse JSON output string back to PortfolioAnalysis
 */
export function parsePortfolioJSON(json: string): PortfolioAnalysis {
  return JSON.parse(json) as PortfolioAnalysis;
}
