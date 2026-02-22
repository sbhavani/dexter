import { z } from 'zod';
import type { DoneEvent, TokenUsage } from './agent/types.js';

// ============================================================================
// Error codes for JSON mode
// ============================================================================

export const ErrorCode = {
  NO_QUERY: 'NO_QUERY',
  AGENT_ERROR: 'AGENT_ERROR',
  PROVIDER_ERROR: 'PROVIDER_ERROR',
  CONFIG_ERROR: 'CONFIG_ERROR',
  UNKNOWN_ERROR: 'UNKNOWN_ERROR',
} as const;

export type ErrorCode = (typeof ErrorCode)[keyof typeof ErrorCode];

// ============================================================================
// Zod Schemas
// ============================================================================

export const ToolRecordSchema = z.object({
  name: z.string(),
  args: z.record(z.string(), z.unknown()),
  result: z.string(),
});

export const TokenUsageSchema = z.object({
  inputTokens: z.number().int().nonnegative(),
  outputTokens: z.number().int().nonnegative(),
  totalTokens: z.number().int().nonnegative(),
});

export const ResponseMetadataSchema = z.object({
  model: z.string(),
  iterations: z.number().int().nonnegative(),
  totalTimeMs: z.number().int().nonnegative(),
  tokenUsage: TokenUsageSchema.optional(),
});

export const ErrorDetailSchema = z.object({
  code: z.enum([
    ErrorCode.NO_QUERY,
    ErrorCode.AGENT_ERROR,
    ErrorCode.PROVIDER_ERROR,
    ErrorCode.CONFIG_ERROR,
    ErrorCode.UNKNOWN_ERROR,
  ]),
  message: z.string(),
});

export const JsonResponseSchema = z.object({
  status: z.enum(['success', 'error']),
  query: z.string(),
  answer: z.string(),
  tools: z.array(ToolRecordSchema),
  scratchpadFile: z.string(),
  metadata: ResponseMetadataSchema,
  error: ErrorDetailSchema.optional(),
});

// ============================================================================
// TypeScript types inferred from Zod schemas
// ============================================================================

export type ToolRecord = z.infer<typeof ToolRecordSchema>;
export type ResponseMetadata = z.infer<typeof ResponseMetadataSchema>;
export type ErrorDetail = z.infer<typeof ErrorDetailSchema>;
export type JsonResponse = z.infer<typeof JsonResponseSchema>;

// ============================================================================
// Response builders
// ============================================================================

export function buildSuccessResponse(
  query: string,
  doneEvent: DoneEvent,
  scratchpadPath: string,
  model: string,
): JsonResponse {
  return {
    status: 'success',
    query,
    answer: doneEvent.answer,
    tools: doneEvent.toolCalls.map((tc) => ({
      name: tc.tool,
      args: tc.args,
      result: tc.result,
    })),
    scratchpadFile: scratchpadPath,
    metadata: {
      model,
      iterations: doneEvent.iterations,
      totalTimeMs: doneEvent.totalTime,
      tokenUsage: doneEvent.tokenUsage
        ? {
            inputTokens: doneEvent.tokenUsage.inputTokens,
            outputTokens: doneEvent.tokenUsage.outputTokens,
            totalTokens: doneEvent.tokenUsage.totalTokens,
          }
        : undefined,
    },
  };
}

export function buildErrorResponse(
  query: string,
  errorCode: ErrorCode,
  message: string,
  scratchpadPath?: string,
  model?: string,
): JsonResponse {
  return {
    status: 'error',
    query,
    answer: '',
    tools: [],
    scratchpadFile: scratchpadPath ?? '',
    metadata: {
      model: model ?? '',
      iterations: 0,
      totalTimeMs: 0,
    },
    error: {
      code: errorCode,
      message,
    },
  };
}
