import { z } from 'zod';

export const TokenUsageRecordSchema = z.object({
  inputTokens: z.number(),
  outputTokens: z.number(),
  totalTokens: z.number(),
});

export type TokenUsageRecord = z.infer<typeof TokenUsageRecordSchema>;

export const SessionExchangeSchema = z.object({
  id: z.string().min(1),
  timestamp: z.number().positive(),
  query: z.string().min(1),
  answer: z.string(),
  summary: z.string().nullable(),
  model: z.string(),
  status: z.enum(['complete', 'error', 'interrupted']),
  duration: z.number().nullable(),
  tokenUsage: TokenUsageRecordSchema.nullable(),
});

export type SessionExchange = z.infer<typeof SessionExchangeSchema>;

export const SessionMetadataSchema = z.object({
  id: z.string().regex(/^[a-z0-9]{8}$/),
  createdAt: z.number().positive(),
  updatedAt: z.number().positive(),
  exchangeCount: z.number().nonnegative(),
  model: z.string(),
  provider: z.string(),
  firstQuery: z.string(),
  lastQuery: z.string(),
});

export type SessionMetadata = z.infer<typeof SessionMetadataSchema>;

export const SessionIndexSchema = z.object({
  version: z.number(),
  sessions: z.record(z.string(), SessionMetadataSchema),
});

export type SessionIndex = z.infer<typeof SessionIndexSchema>;

export interface SessionOptions {
  sessionId?: string;
  listSessions?: boolean;
  deleteSession?: string;
  json?: boolean;
}
