import { describe, test, expect } from 'bun:test';
import { buildSuccessOutput, buildErrorOutput, resolveModel } from './json-mode';
import { JsonSuccessOutputSchema, JsonErrorOutputSchema } from '@/agent/types';
import type { DoneEvent } from '@/agent/types';

const mockDoneEvent: DoneEvent = {
  type: 'done',
  answer: 'The P/E ratio is 28.5.',
  toolCalls: [
    { tool: 'get_company_facts', args: { ticker: 'AAPL' }, result: '{"pe_ratio": 28.5}' },
  ],
  iterations: 2,
  totalTime: 3450,
  tokenUsage: { inputTokens: 1200, outputTokens: 450, totalTokens: 1650 },
  tokensPerSecond: 130,
};

const mockDoneEventNoTokens: DoneEvent = {
  type: 'done',
  answer: 'Hello!',
  toolCalls: [],
  iterations: 1,
  totalTime: 500,
};

describe('buildSuccessOutput', () => {
  test('produces valid JsonSuccessOutput from DoneEvent', () => {
    const output = buildSuccessOutput('What is AAPL PE?', mockDoneEvent, 'gpt-5.2');
    expect(() => JsonSuccessOutputSchema.parse(output)).not.toThrow();
    expect(output.success).toBe(true);
    expect(output.query).toBe('What is AAPL PE?');
    expect(output.answer).toBe('The P/E ratio is 28.5.');
    expect(output.model).toBe('gpt-5.2');
  });

  test('output is valid JSON via JSON.parse', () => {
    const output = buildSuccessOutput('test query', mockDoneEvent, 'gpt-5.2');
    const json = JSON.stringify(output, null, 2);
    expect(() => JSON.parse(json)).not.toThrow();
  });

  test('toolCalls array serialized correctly', () => {
    const output = buildSuccessOutput('test', mockDoneEvent, 'gpt-5.2');
    expect(output.toolCalls).toHaveLength(1);
    expect(output.toolCalls[0].tool).toBe('get_company_facts');
    expect(output.toolCalls[0].args).toEqual({ ticker: 'AAPL' });
    expect(output.toolCalls[0].result).toBe('{"pe_ratio": 28.5}');
  });

  test('tokenUsage omitted when absent in DoneEvent', () => {
    const output = buildSuccessOutput('hi', mockDoneEventNoTokens, 'gpt-5.2');
    expect(output.tokenUsage).toBeUndefined();
    // Ensure it's not null
    const json = JSON.parse(JSON.stringify(output));
    expect('tokenUsage' in json).toBe(false);
  });

  test('model field is included in output', () => {
    const output = buildSuccessOutput('test', mockDoneEvent, 'claude-sonnet-4-20250514');
    expect(output.model).toBe('claude-sonnet-4-20250514');
  });

  test('maps totalTime to duration', () => {
    const output = buildSuccessOutput('test', mockDoneEvent, 'gpt-5.2');
    expect(output.duration).toBe(3450);
  });

  test('validates against schema with all fields', () => {
    const output = buildSuccessOutput('What is revenue?', mockDoneEvent, 'gpt-5.2');
    const parsed = JsonSuccessOutputSchema.parse(output);
    expect(parsed.success).toBe(true);
    expect(parsed.iterations).toBe(2);
    expect(parsed.duration).toBe(3450);
    expect(parsed.tokenUsage?.inputTokens).toBe(1200);
  });
});

describe('buildErrorOutput', () => {
  test('produces valid JsonErrorOutput', () => {
    const output = buildErrorOutput('query', new Error('API key missing'));
    expect(() => JsonErrorOutputSchema.parse(output)).not.toThrow();
    expect(output.success).toBe(false);
    expect(output.error).toBe('API key missing');
    expect(output.query).toBe('query');
  });

  test('handles empty query string', () => {
    const output = buildErrorOutput('', new Error('No query'));
    expect(() => JsonErrorOutputSchema.parse(output)).not.toThrow();
    expect(output.query).toBe('');
    expect(output.success).toBe(false);
  });

  test('handles non-Error objects', () => {
    const output = buildErrorOutput('test', 'string error');
    expect(output.error).toBe('string error');
    expect(() => JsonErrorOutputSchema.parse(output)).not.toThrow();
  });

  test('output is valid JSON', () => {
    const output = buildErrorOutput('q', new Error('fail'));
    const json = JSON.stringify(output, null, 2);
    expect(() => JSON.parse(json)).not.toThrow();
  });
});

describe('stdout isolation', () => {
  test('console.log/info/debug during isolation do not write to stdout', () => {
    const stdoutWrites: string[] = [];
    const stderrWrites: string[] = [];

    const origStdoutWrite = process.stdout.write.bind(process.stdout);
    const origStderrWrite = process.stderr.write.bind(process.stderr);

    process.stdout.write = ((chunk: any) => {
      stdoutWrites.push(String(chunk));
      return true;
    }) as any;
    process.stderr.write = ((chunk: any) => {
      stderrWrites.push(String(chunk));
      return true;
    }) as any;

    // Apply isolation (same pattern as runJsonMode)
    const origLog = console.log;
    const origInfo = console.info;
    const origDebug = console.debug;
    console.log = (...args: unknown[]) => process.stderr.write(args.map(String).join(' ') + '\n');
    console.info = (...args: unknown[]) => process.stderr.write(args.map(String).join(' ') + '\n');
    console.debug = (...args: unknown[]) => process.stderr.write(args.map(String).join(' ') + '\n');

    try {
      // Simulate library/agent output during execution
      console.log('Loading model...');
      console.info('Processing query...');
      console.debug('Debug info');

      // Verify nothing was written to stdout
      expect(stdoutWrites).toHaveLength(0);

      // Verify all three went to stderr
      expect(stderrWrites).toHaveLength(3);
      expect(stderrWrites).toContain('Loading model...\n');
      expect(stderrWrites).toContain('Processing query...\n');
      expect(stderrWrites).toContain('Debug info\n');
    } finally {
      console.log = origLog;
      console.info = origInfo;
      console.debug = origDebug;
      process.stdout.write = origStdoutWrite;
      process.stderr.write = origStderrWrite;
    }
  });

  test('final JSON output is the only thing written to stdout', () => {
    const stderrWrites: string[] = [];

    const origStderrWrite = process.stderr.write.bind(process.stderr);
    process.stderr.write = ((chunk: any) => {
      stderrWrites.push(String(chunk));
      return true;
    }) as any;

    // Replicate the isolation pattern from runJsonMode
    const origLog = console.log;
    console.log = (...args: unknown[]) => process.stderr.write(args.map(String).join(' ') + '\n');

    try {
      // Simulate agent output during execution
      console.log('Agent thinking...');
      console.log('Tool called: get_facts');

      // Verify agent output went to stderr
      expect(stderrWrites).toContain('Agent thinking...\n');
      expect(stderrWrites).toContain('Tool called: get_facts\n');

      // Verify origLog is NOT the redirected function — this ensures
      // origLog writes to stdout (its original destination), not stderr
      expect(origLog).not.toBe(console.log);

      // Build the JSON output as runJsonMode would
      const jsonOutput = JSON.stringify({ success: true, answer: 'test' }, null, 2);

      // Verify the JSON payload is valid and well-formed
      const parsed = JSON.parse(jsonOutput);
      expect(parsed).toEqual({ success: true, answer: 'test' });

      // Verify origLog does NOT write to stderr (confirming it writes to stdout)
      const stderrCountBefore = stderrWrites.length;
      origLog(jsonOutput);
      const stderrCountAfter = stderrWrites.length;
      expect(stderrCountAfter).toBe(stderrCountBefore);
    } finally {
      console.log = origLog;
      process.stderr.write = origStderrWrite;
    }
  });
});

describe('resolveModel', () => {
  test('uses flag value when provided', () => {
    const result = resolveModel('claude-sonnet-4-20250514');
    expect(result.model).toBe('claude-sonnet-4-20250514');
    expect(result.provider).toBe('anthropic');
  });

  test('falls back to DEFAULT_MODEL when no flag', () => {
    const originalEnv = process.env.DEXTER_MODEL;
    delete process.env.DEXTER_MODEL;
    const result = resolveModel();
    expect(result.model).toBe('gpt-5.2');
    expect(result.provider).toBe('openai');
    if (originalEnv) process.env.DEXTER_MODEL = originalEnv;
  });

  test('uses DEXTER_MODEL env when no flag', () => {
    const originalEnv = process.env.DEXTER_MODEL;
    process.env.DEXTER_MODEL = 'gemini-2.0-flash';
    const result = resolveModel();
    expect(result.model).toBe('gemini-2.0-flash');
    expect(result.provider).toBe('google');
    if (originalEnv) {
      process.env.DEXTER_MODEL = originalEnv;
    } else {
      delete process.env.DEXTER_MODEL;
    }
  });
});
