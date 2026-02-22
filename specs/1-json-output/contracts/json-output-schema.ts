/**
 * JSON Output Mode — Contract / Schema Definition
 *
 * This file defines the Zod schemas and TypeScript types for the JSON output
 * mode of Dexter. It serves as the contract between the agent execution layer
 * and the JSON serialization layer.
 *
 * These schemas are used both for:
 * 1. Runtime validation of output before serialization
 * 2. TypeScript type inference for compile-time safety
 */

import { z } from 'zod';

// --- Reused sub-schemas (matching existing agent types) ---

export const TokenUsageSchema = z.object({
  inputTokens: z.number().int().nonnegative(),
  outputTokens: z.number().int().nonnegative(),
  totalTokens: z.number().int().nonnegative(),
});

export const ToolCallRecordSchema = z.object({
  tool: z.string().min(1),
  args: z.record(z.unknown()),
  result: z.string(),
});

// --- JSON Output schemas ---

export const JsonSuccessOutputSchema = z.object({
  success: z.literal(true),
  query: z.string().min(1),
  answer: z.string().min(1),
  model: z.string().min(1),
  toolCalls: z.array(ToolCallRecordSchema),
  iterations: z.number().int().positive(),
  duration: z.number().nonnegative(),
  tokenUsage: TokenUsageSchema.optional(),
});

export const JsonErrorOutputSchema = z.object({
  success: z.literal(false),
  query: z.string(),
  error: z.string().min(1),
});

export const JsonOutputSchema = z.discriminatedUnion('success', [
  JsonSuccessOutputSchema,
  JsonErrorOutputSchema,
]);

// --- CLI argument schema ---

export const ParsedArgsSchema = z.object({
  json: z.boolean(),
  model: z.string().min(1).optional(),
  query: z.string().min(1).optional(),
});

// --- Inferred TypeScript types ---

export type TokenUsage = z.infer<typeof TokenUsageSchema>;
export type ToolCallRecord = z.infer<typeof ToolCallRecordSchema>;
export type JsonSuccessOutput = z.infer<typeof JsonSuccessOutputSchema>;
export type JsonErrorOutput = z.infer<typeof JsonErrorOutputSchema>;
export type JsonOutput = z.infer<typeof JsonOutputSchema>;
export type ParsedArgs = z.infer<typeof ParsedArgsSchema>;
