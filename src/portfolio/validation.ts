/**
 * Portfolio Validation Schema
 * Zod validation schemas for portfolio input
 */
import { z } from 'zod';

// Supported time periods
export const PeriodSchema = z.enum(['1m', '3m', '6m', '1y', 'ytd', 'custom']);

// Portfolio input schema for CLI/API
export const PortfolioInputSchema = z.object({
  tickers: z.array(z.string())
    .min(2, 'Portfolio must contain at least 2 tickers for meaningful comparison')
    .max(50, 'Portfolio cannot exceed 50 tickers'),
  period: PeriodSchema.default('1y'),
  startDate: z.string().optional(),
  endDate: z.string().optional(),
  benchmark: z.string().default('^GSPC'),
  weights: z.array(z.number()
    .min(0, 'Weights must be non-negative')
    .max(1, 'Weights cannot exceed 1'))
    .optional(),
});

// Type exports from schema
export type PortfolioInput = z.infer<typeof PortfolioInputSchema>;

// Validation result
export interface ValidationResult {
  valid: boolean;
  errors: string[];
  warnings: string[];
}

/**
 * Validate tickers - basic format check
 */
export function validateTickers(tickers: string[]): ValidationResult {
  const errors: string[] = [];
  const warnings: string[] = [];

  // Check for empty tickers
  const emptyTickers = tickers.filter(t => !t.trim());
  if (emptyTickers.length > 0) {
    errors.push('Empty ticker symbols are not allowed');
  }

  // Check ticker format (letters only, 1-5 chars)
  const invalidFormat = tickers.filter(t => !/^[A-Za-z]{1,5}$/.test(t.trim()));
  if (invalidFormat.length > 0) {
    errors.push(`Invalid ticker format: ${invalidFormat.join(', ')}. Tickers should be 1-5 letters.`);
  }

  // Normalize to uppercase
  const normalized = tickers.map(t => t.trim().toUpperCase());

  // Check for duplicates
  const duplicates = normalized.filter((t, i) => normalized.indexOf(t) !== i);
  if (duplicates.length > 0) {
    warnings.push(`Duplicate tickers detected: ${[...new Set(duplicates)].join(', ')}`);
  }

  return {
    valid: errors.length === 0,
    errors,
    warnings,
  };
}

/**
 * Validate portfolio weights
 */
export function validateWeights(tickers: string[], weights?: number[]): ValidationResult {
  const errors: string[] = [];
  const warnings: string[] = [];

  if (!weights) {
    return { valid: true, errors: [], warnings };
  }

  if (weights.length !== tickers.length) {
    errors.push(`Number of weights (${weights.length}) must match number of tickers (${tickers.length})`);
    return { valid: false, errors, warnings };
  }

  const sum = weights.reduce((a, b) => a + b, 0);
  if (Math.abs(sum - 1) > 0.001) {
    errors.push(`Weights must sum to 1, got ${sum.toFixed(4)}`);
  }

  const negative = weights.filter(w => w < 0);
  if (negative.length > 0) {
    errors.push('Weights cannot be negative');
  }

  return {
    valid: errors.length === 0,
    errors,
    warnings,
  };
}

/**
 * Validate date range
 */
export function validateDateRange(start?: string, end?: string): ValidationResult {
  const errors: string[] = [];
  const warnings: string[] = [];

  if (!start || !end) {
    return { valid: true, errors: [], warnings };
  }

  const startDate = new Date(start);
  const endDate = new Date(end);

  if (isNaN(startDate.getTime())) {
    errors.push(`Invalid start date: ${start}`);
  }

  if (isNaN(endDate.getTime())) {
    errors.push(`Invalid end date: ${end}`);
  }

  if (!errors.length && startDate >= endDate) {
    errors.push('Start date must be before end date');
  }

  const today = new Date();
  today.setHours(23, 59, 59, 999);
  if (!errors.length && endDate > today) {
    errors.push('End date cannot be in the future');
  }

  // Check max range (5 years)
  const maxDate = new Date(today);
  maxDate.setFullYear(maxDate.getFullYear() - 5);
  if (!errors.length && startDate < maxDate) {
    warnings.push('Date range exceeds 5 years, will be capped');
  }

  return {
    valid: errors.length === 0,
    errors,
    warnings,
  };
}
