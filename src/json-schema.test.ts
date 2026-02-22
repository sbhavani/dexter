import { describe, test, expect } from 'bun:test';
import {
  JsonResponseSchema,
  ToolRecordSchema,
  TokenUsageSchema,
  ResponseMetadataSchema,
  ErrorDetailSchema,
  ErrorCode,
  buildSuccessResponse,
  buildErrorResponse,
} from './json-schema.js';
import type { DoneEvent } from './agent/types.js';

// ============================================================================
// Schema validation
// ============================================================================

describe('ToolRecordSchema', () => {
  test('validates a valid tool record', () => {
    const record = { name: 'financial_search', args: { query: 'AAPL revenue' }, result: '{"data":{}}' };
    expect(() => ToolRecordSchema.parse(record)).not.toThrow();
  });

  test('rejects missing fields', () => {
    expect(() => ToolRecordSchema.parse({ name: 'test' })).toThrow();
  });
});

describe('TokenUsageSchema', () => {
  test('validates valid token usage', () => {
    const usage = { inputTokens: 100, outputTokens: 50, totalTokens: 150 };
    expect(() => TokenUsageSchema.parse(usage)).not.toThrow();
  });

  test('rejects negative values', () => {
    expect(() => TokenUsageSchema.parse({ inputTokens: -1, outputTokens: 0, totalTokens: 0 })).toThrow();
  });
});

describe('ResponseMetadataSchema', () => {
  test('validates with token usage', () => {
    const meta = {
      model: 'gpt-5.2',
      iterations: 2,
      totalTimeMs: 5000,
      tokenUsage: { inputTokens: 100, outputTokens: 50, totalTokens: 150 },
    };
    expect(() => ResponseMetadataSchema.parse(meta)).not.toThrow();
  });

  test('validates without token usage', () => {
    const meta = { model: 'gpt-5.2', iterations: 2, totalTimeMs: 5000 };
    expect(() => ResponseMetadataSchema.parse(meta)).not.toThrow();
  });
});

describe('ErrorDetailSchema', () => {
  test('validates all error codes', () => {
    for (const code of Object.values(ErrorCode)) {
      expect(() => ErrorDetailSchema.parse({ code, message: 'test' })).not.toThrow();
    }
  });

  test('rejects invalid error code', () => {
    expect(() => ErrorDetailSchema.parse({ code: 'INVALID', message: 'test' })).toThrow();
  });
});

describe('JsonResponseSchema', () => {
  test('validates a success response', () => {
    const response = {
      status: 'success',
      query: 'What is Apple revenue?',
      answer: 'Apple revenue is $394B.',
      tools: [{ name: 'financial_search', args: { query: 'AAPL' }, result: '{}' }],
      scratchpadFile: '.dexter/scratchpad/2026-01-01-120000_abc123.jsonl',
      metadata: { model: 'gpt-5.2', iterations: 2, totalTimeMs: 5000 },
    };
    expect(() => JsonResponseSchema.parse(response)).not.toThrow();
  });

  test('validates an error response with error field', () => {
    const response = {
      status: 'error',
      query: '',
      answer: '',
      tools: [],
      scratchpadFile: '',
      metadata: { model: '', iterations: 0, totalTimeMs: 0 },
      error: { code: 'NO_QUERY', message: 'No query provided.' },
    };
    expect(() => JsonResponseSchema.parse(response)).not.toThrow();
  });

  test('success response does not have error field', () => {
    const response = buildSuccessResponse(
      'test query',
      makeDoneEvent({ answer: 'test answer' }),
      '.dexter/scratchpad/test.jsonl',
      'gpt-5.2',
    );
    expect(response.error).toBeUndefined();
    expect(response.status).toBe('success');
  });

  test('error response has error field', () => {
    const response = buildErrorResponse('', ErrorCode.NO_QUERY, 'No query');
    expect(response.error).toBeDefined();
    expect(response.error!.code).toBe('NO_QUERY');
    expect(response.status).toBe('error');
  });

  test('rejects invalid status', () => {
    const response = {
      status: 'unknown',
      query: 'test',
      answer: '',
      tools: [],
      scratchpadFile: '',
      metadata: { model: '', iterations: 0, totalTimeMs: 0 },
    };
    expect(() => JsonResponseSchema.parse(response)).toThrow();
  });
});

// ============================================================================
// buildSuccessResponse
// ============================================================================

describe('buildSuccessResponse', () => {
  test('maps DoneEvent fields correctly', () => {
    const doneEvent = makeDoneEvent({
      answer: 'Revenue is $394B',
      toolCalls: [{ tool: 'financial_search', args: { query: 'AAPL' }, result: '{"data":{}}' }],
      iterations: 3,
      totalTime: 8500,
      tokenUsage: { inputTokens: 1200, outputTokens: 800, totalTokens: 2000 },
    });

    const response = buildSuccessResponse('What is Apple revenue?', doneEvent, '.dexter/scratchpad/test.jsonl', 'claude-sonnet-4-6');

    expect(response.status).toBe('success');
    expect(response.query).toBe('What is Apple revenue?');
    expect(response.answer).toBe('Revenue is $394B');
    expect(response.tools).toHaveLength(1);
    expect(response.tools[0].name).toBe('financial_search');
    expect(response.scratchpadFile).toBe('.dexter/scratchpad/test.jsonl');
    expect(response.metadata.model).toBe('claude-sonnet-4-6');
    expect(response.metadata.iterations).toBe(3);
    expect(response.metadata.totalTimeMs).toBe(8500);
    expect(response.metadata.tokenUsage?.inputTokens).toBe(1200);
    expect(response.error).toBeUndefined();
  });

  test('produces valid JSON when stringified', () => {
    const response = buildSuccessResponse(
      'test',
      makeDoneEvent({ answer: 'answer' }),
      '.dexter/scratchpad/test.jsonl',
      'gpt-5.2',
    );
    const json = JSON.stringify(response);
    expect(() => JSON.parse(json)).not.toThrow();
    expect(() => JsonResponseSchema.parse(JSON.parse(json))).not.toThrow();
  });

  test('handles missing tokenUsage', () => {
    const doneEvent = makeDoneEvent({ answer: 'answer', tokenUsage: undefined });
    const response = buildSuccessResponse('q', doneEvent, 'path', 'model');
    expect(response.metadata.tokenUsage).toBeUndefined();
  });

  test('all required fields are present', () => {
    const response = buildSuccessResponse('q', makeDoneEvent({}), 'path', 'model');
    expect(response).toHaveProperty('status');
    expect(response).toHaveProperty('query');
    expect(response).toHaveProperty('answer');
    expect(response).toHaveProperty('tools');
    expect(response).toHaveProperty('scratchpadFile');
    expect(response).toHaveProperty('metadata');
  });
});

// ============================================================================
// buildErrorResponse
// ============================================================================

describe('buildErrorResponse', () => {
  test('builds error response with all error codes', () => {
    for (const code of Object.values(ErrorCode)) {
      const response = buildErrorResponse('q', code, `Error: ${code}`);
      expect(response.status).toBe('error');
      expect(response.error!.code).toBe(code);
      expect(response.answer).toBe('');
      expect(response.tools).toEqual([]);
    }
  });

  test('uses defaults for optional parameters', () => {
    const response = buildErrorResponse('', ErrorCode.NO_QUERY, 'No query');
    expect(response.scratchpadFile).toBe('');
    expect(response.metadata.model).toBe('');
    expect(response.metadata.iterations).toBe(0);
    expect(response.metadata.totalTimeMs).toBe(0);
  });

  test('uses provided scratchpadPath and model', () => {
    const response = buildErrorResponse('q', ErrorCode.AGENT_ERROR, 'Failed', 'path.jsonl', 'gpt-5.2');
    expect(response.scratchpadFile).toBe('path.jsonl');
    expect(response.metadata.model).toBe('gpt-5.2');
  });

  test('produces valid JSON when stringified', () => {
    const response = buildErrorResponse('q', ErrorCode.UNKNOWN_ERROR, 'Unknown');
    const json = JSON.stringify(response);
    expect(() => JSON.parse(json)).not.toThrow();
    expect(() => JsonResponseSchema.parse(JSON.parse(json))).not.toThrow();
  });

  test('all required fields are present including error', () => {
    const response = buildErrorResponse('q', ErrorCode.NO_QUERY, 'msg');
    expect(response).toHaveProperty('status');
    expect(response).toHaveProperty('query');
    expect(response).toHaveProperty('answer');
    expect(response).toHaveProperty('tools');
    expect(response).toHaveProperty('scratchpadFile');
    expect(response).toHaveProperty('metadata');
    expect(response).toHaveProperty('error');
    expect(response.error).toHaveProperty('code');
    expect(response.error).toHaveProperty('message');
  });
});

// ============================================================================
// Helpers
// ============================================================================

function makeDoneEvent(overrides: Partial<DoneEvent> = {}): DoneEvent {
  return {
    type: 'done',
    answer: overrides.answer ?? '',
    toolCalls: overrides.toolCalls ?? [],
    iterations: overrides.iterations ?? 0,
    totalTime: overrides.totalTime ?? 0,
    tokenUsage: overrides.tokenUsage,
    tokensPerSecond: overrides.tokensPerSecond,
  };
}
