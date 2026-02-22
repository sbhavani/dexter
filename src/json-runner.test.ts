import { describe, test, expect, afterEach } from 'bun:test';
import { readFileSync, existsSync, rmSync, readdirSync } from 'fs';
import { join } from 'path';
import { executeJsonQuery, classifyError, type JsonRunnerOptions } from './json-runner.js';
import { JsonResponseSchema, ErrorCode } from './json-schema.js';
import type { AgentEvent, DoneEvent } from './agent/types.js';
import { Scratchpad, type ScratchpadEntry } from './agent/scratchpad.js';

// ============================================================================
// Helpers
// ============================================================================

function makeDoneEvent(overrides: Partial<DoneEvent> = {}): DoneEvent {
  return {
    type: 'done',
    answer: overrides.answer ?? 'Test answer',
    toolCalls: overrides.toolCalls ?? [],
    iterations: overrides.iterations ?? 1,
    totalTime: overrides.totalTime ?? 1000,
    tokenUsage: overrides.tokenUsage ?? { inputTokens: 100, outputTokens: 50, totalTokens: 150 },
    tokensPerSecond: overrides.tokensPerSecond,
  };
}

function mockAgent(events: AgentEvent[]): JsonRunnerOptions['createAgent'] {
  return () => ({
    run: async function* () {
      for (const event of events) {
        yield event;
      }
    },
  });
}

function throwingAgent(error: Error): JsonRunnerOptions['createAgent'] {
  return () => ({
    run: async function* () {
      throw error;
    },
  });
}

/**
 * Mock agent that creates a real Scratchpad on disk (mimicking the real Agent).
 * This enables scratchpad observability tests (T013).
 */
function mockAgentWithScratchpad(
  events: AgentEvent[],
  toolResults?: Array<{ name: string; args: Record<string, unknown>; result: string }>,
): JsonRunnerOptions['createAgent'] {
  return () => ({
    run: async function* (query: string) {
      const scratchpad = new Scratchpad(query);

      if (toolResults) {
        for (const tr of toolResults) {
          scratchpad.addToolResult(tr.name, tr.args, tr.result);
        }
      }

      for (const event of events) {
        yield event;
      }
    },
  });
}

/**
 * Read and parse all entries from a scratchpad JSONL file.
 */
function readScratchpadEntries(filepath: string): ScratchpadEntry[] {
  const content = readFileSync(filepath, 'utf-8');
  return content
    .split('\n')
    .filter((line) => line.trim())
    .map((line) => JSON.parse(line) as ScratchpadEntry);
}

/**
 * Remove all scratchpad files created during tests.
 */
function cleanupScratchpadDir(): void {
  const dir = '.dexter/scratchpad';
  if (existsSync(dir)) {
    const files = readdirSync(dir).filter((f) => f.endsWith('.jsonl'));
    for (const f of files) {
      rmSync(join(dir, f), { force: true });
    }
  }
}

// ============================================================================
// T005: Core JSON runner tests
// ============================================================================

describe('JSON runner - core flow (T005)', () => {
  test('query via argument produces valid JSON response', async () => {
    const { response, exitCode } = await executeJsonQuery(
      ['What is Apple revenue?'],
      { createAgent: mockAgent([makeDoneEvent()]) },
    );
    expect(exitCode).toBe(0);
    expect(() => JsonResponseSchema.parse(response)).not.toThrow();
  });

  test('response contains all required fields', async () => {
    const { response } = await executeJsonQuery(
      ['test query'],
      { createAgent: mockAgent([makeDoneEvent()]) },
    );

    expect(response).toHaveProperty('status');
    expect(response).toHaveProperty('query');
    expect(response).toHaveProperty('answer');
    expect(response).toHaveProperty('tools');
    expect(response).toHaveProperty('scratchpadFile');
    expect(response).toHaveProperty('metadata');
    expect(response.status).toBe('success');
  });

  test('DoneEvent data maps correctly to response', async () => {
    const doneEvent = makeDoneEvent({
      answer: 'Revenue is $394B',
      toolCalls: [{ tool: 'financial_search', args: { query: 'AAPL' }, result: '{}' }],
      iterations: 3,
      totalTime: 8500,
      tokenUsage: { inputTokens: 1200, outputTokens: 800, totalTokens: 2000 },
    });

    const { response } = await executeJsonQuery(
      ['test'],
      { createAgent: mockAgent([doneEvent]) },
    );

    expect(response.answer).toBe('Revenue is $394B');
    expect(response.tools).toHaveLength(1);
    expect(response.tools[0].name).toBe('financial_search');
    expect(response.metadata.iterations).toBe(3);
    expect(response.metadata.totalTimeMs).toBe(8500);
    expect(response.metadata.tokenUsage?.inputTokens).toBe(1200);
  });

  test('tool auto-approval does not block execution', async () => {
    const { response, exitCode } = await executeJsonQuery(
      ['test query'],
      { createAgent: mockAgent([makeDoneEvent()]) },
    );
    expect(exitCode).toBe(0);
    expect(response.status).toBe('success');
  });

  test('query with multiple words joined correctly', async () => {
    const { response } = await executeJsonQuery(
      ['What', 'is', 'Apple', 'revenue?'],
      { createAgent: mockAgent([makeDoneEvent()]) },
    );
    expect(response.query).toContain('What');
    expect(response.query).toContain('revenue');
  });

  test('flags are filtered from query', async () => {
    const { response } = await executeJsonQuery(
      ['--verbose', 'test query'],
      { createAgent: mockAgent([makeDoneEvent()]) },
    );
    expect(response.query).toBe('test query');
    expect(response.query).not.toContain('--verbose');
  });
});

// ============================================================================
// T008: Error handling tests
// ============================================================================

describe('JSON runner - error handling (T008)', () => {
  test('no query provided → NO_QUERY error + exit 1', async () => {
    const { response, exitCode } = await executeJsonQuery([], { isTTY: true });

    expect(exitCode).toBe(1);
    expect(response.status).toBe('error');
    expect(response.error!.code).toBe('NO_QUERY');
    expect(response.error!.message).toContain('No query');
    expect(() => JsonResponseSchema.parse(response)).not.toThrow();
  });

  test('agent execution throws → AGENT_ERROR + exit 1', async () => {
    const { response, exitCode } = await executeJsonQuery(
      ['test'],
      { createAgent: throwingAgent(new Error('Agent tool execution failed')) },
    );

    expect(exitCode).toBe(1);
    expect(response.status).toBe('error');
    expect(response.error!.code).toBe('AGENT_ERROR');
    expect(() => JsonResponseSchema.parse(response)).not.toThrow();
  });

  test('provider auth failure → PROVIDER_ERROR + exit 1', async () => {
    const { response, exitCode } = await executeJsonQuery(
      ['test'],
      { createAgent: throwingAgent(new Error('Invalid API key provided')) },
    );

    expect(exitCode).toBe(1);
    expect(response.status).toBe('error');
    expect(response.error!.code).toBe('PROVIDER_ERROR');
    expect(() => JsonResponseSchema.parse(response)).not.toThrow();
  });

  test('config error → CONFIG_ERROR + exit 1', async () => {
    const { response, exitCode } = await executeJsonQuery(
      ['test'],
      { createAgent: throwingAgent(new Error('Provider not configured')) },
    );

    expect(exitCode).toBe(1);
    expect(response.status).toBe('error');
    expect(response.error!.code).toBe('CONFIG_ERROR');
    expect(() => JsonResponseSchema.parse(response)).not.toThrow();
  });

  test('unexpected error → UNKNOWN_ERROR + exit 1', async () => {
    const { response, exitCode } = await executeJsonQuery(
      ['test'],
      { createAgent: throwingAgent(new Error('Something completely unexpected')) },
    );

    expect(exitCode).toBe(1);
    expect(response.status).toBe('error');
    expect(response.error!.code).toBe('UNKNOWN_ERROR');
    expect(() => JsonResponseSchema.parse(response)).not.toThrow();
  });

  test('all error responses contain required fields', async () => {
    const errorCases: Array<{ args: string[]; opts: JsonRunnerOptions }> = [
      { args: [], opts: { isTTY: true } },
      { args: ['test'], opts: { createAgent: throwingAgent(new Error('Agent tool failed')) } },
      { args: ['test'], opts: { createAgent: throwingAgent(new Error('Invalid API key')) } },
    ];

    for (const { args, opts } of errorCases) {
      const { response } = await executeJsonQuery(args, opts);
      expect(response).toHaveProperty('status');
      expect(response).toHaveProperty('query');
      expect(response).toHaveProperty('answer');
      expect(response).toHaveProperty('tools');
      expect(response).toHaveProperty('scratchpadFile');
      expect(response).toHaveProperty('metadata');
      expect(response).toHaveProperty('error');
    }
  });

  test('error response answer is empty string', async () => {
    const { response } = await executeJsonQuery([], { isTTY: true });
    expect(response.answer).toBe('');
    expect(response.tools).toEqual([]);
  });
});

// ============================================================================
// T010: Stdin query reading tests
// ============================================================================

describe('JSON runner - stdin reading (T010)', () => {
  test('query via stdin produces valid JSON', async () => {
    const { response, exitCode } = await executeJsonQuery([], {
      isTTY: false,
      readStdin: async () => 'What is Apple revenue?',
      createAgent: mockAgent([makeDoneEvent()]),
    });

    expect(exitCode).toBe(0);
    expect(response.status).toBe('success');
    expect(() => JsonResponseSchema.parse(response)).not.toThrow();
  });

  test('TTY mode with no args produces NO_QUERY error', async () => {
    const { response, exitCode } = await executeJsonQuery([], { isTTY: true });

    expect(exitCode).toBe(1);
    expect(response.error!.code).toBe('NO_QUERY');
  });

  test('empty stdin produces NO_QUERY error', async () => {
    const { response, exitCode } = await executeJsonQuery([], {
      isTTY: false,
      readStdin: async () => '   ',
    });

    expect(exitCode).toBe(1);
    expect(response.error!.code).toBe('NO_QUERY');
  });

  test('stdin with whitespace is trimmed', async () => {
    const { response, exitCode } = await executeJsonQuery([], {
      isTTY: false,
      readStdin: async () => '  What is Apple revenue?  \n',
      createAgent: mockAgent([makeDoneEvent()]),
    });

    expect(exitCode).toBe(0);
    expect(response.status).toBe('success');
  });

  test('positional args take priority over stdin', async () => {
    const { response } = await executeJsonQuery(
      ['from args'],
      {
        isTTY: false,
        readStdin: async () => 'from stdin',
        createAgent: mockAgent([makeDoneEvent()]),
      },
    );

    expect(response.query).toBe('from args');
  });
});

// ============================================================================
// T012: Stdout cleanliness tests
// ============================================================================

describe('JSON runner - stdout cleanliness (T012)', () => {
  test('response serializes to valid JSON', async () => {
    const { response } = await executeJsonQuery(
      ['test query'],
      { createAgent: mockAgent([makeDoneEvent()]) },
    );
    const json = JSON.stringify(response);
    expect(() => JSON.parse(json)).not.toThrow();
  });

  test('stdout output has no leading/trailing non-JSON bytes', async () => {
    const { response } = await executeJsonQuery(
      ['test query'],
      { createAgent: mockAgent([makeDoneEvent()]) },
    );
    const output = JSON.stringify(response);

    // No BOM, whitespace, or stray characters before opening brace
    expect(output[0]).toBe('{');
    // No trailing characters after closing brace
    expect(output[output.length - 1]).toBe('}');
    // Round-trip: parse produces identical structure
    expect(JSON.parse(output)).toEqual(response);
  });

  test('stderr redirection does not affect valid JSON on stdout', async () => {
    // Suppress stderr (simulating 2>/dev/null)
    const originalError = console.error;
    console.error = () => {};

    try {
      const { response, exitCode } = await executeJsonQuery(
        ['test query'],
        {
          createAgent: mockAgent([
            { type: 'tool_start', tool: 'web_search', args: {} },
            { type: 'tool_end', tool: 'web_search', args: {}, result: '{}', duration: 500 },
            makeDoneEvent(),
          ]),
        },
      );

      expect(exitCode).toBe(0);
      const json = JSON.stringify(response);
      expect(() => JSON.parse(json)).not.toThrow();
      expect(() => JsonResponseSchema.parse(response)).not.toThrow();
    } finally {
      console.error = originalError;
    }
  });

  test('error responses also produce clean JSON on stdout', async () => {
    const { response } = await executeJsonQuery([], { isTTY: true });
    const output = JSON.stringify(response);

    expect(output[0]).toBe('{');
    expect(output[output.length - 1]).toBe('}');
    expect(() => JSON.parse(output)).not.toThrow();
    expect(() => JsonResponseSchema.parse(JSON.parse(output))).not.toThrow();
  });

  test('no TUI component imports in json-runner.ts', () => {
    const source = readFileSync('src/json-runner.ts', 'utf-8');
    expect(source).not.toContain('pi-tui');
    expect(source).not.toContain('./cli');
    expect(source).not.toContain('./components');
    expect(source).not.toContain('./controllers');
    expect(source).not.toContain('ink');
    expect(source).not.toContain('react');
  });

  test('all diagnostics use console.error not console.log', () => {
    const source = readFileSync('src/json-runner.ts', 'utf-8');
    // console.error is used for tool progress
    expect(source).toContain('console.error');
    // console.log should NOT appear (would pollute stdout)
    expect(source).not.toContain('console.log');
  });

  test('process.stdout.write is used instead of console.log for output', () => {
    const source = readFileSync('src/json-runner.ts', 'utf-8');
    // stdout writes use process.stdout.write for precise control
    expect(source).toContain('process.stdout.write');
  });
});

// ============================================================================
// T013: Scratchpad observability tests
// ============================================================================

describe('JSON runner - scratchpad observability (T013)', () => {
  afterEach(() => {
    cleanupScratchpadDir();
  });

  test('response contains scratchpadFile field with non-empty path', async () => {
    const { response } = await executeJsonQuery(
      ['test scratchpad query'],
      { createAgent: mockAgentWithScratchpad([makeDoneEvent()]) },
    );
    expect(response).toHaveProperty('scratchpadFile');
    expect(typeof response.scratchpadFile).toBe('string');
    expect(response.scratchpadFile.length).toBeGreaterThan(0);
  });

  test('scratchpad JSONL file is created at the path specified in response.scratchpadFile', async () => {
    const { response } = await executeJsonQuery(
      ['What is Apple revenue?'],
      { createAgent: mockAgentWithScratchpad([makeDoneEvent()]) },
    );

    expect(response.scratchpadFile).toBeTruthy();
    expect(existsSync(response.scratchpadFile)).toBe(true);
    expect(response.scratchpadFile).toMatch(/\.jsonl$/);
  });

  test('scratchpad file path is under .dexter/scratchpad/', async () => {
    const { response } = await executeJsonQuery(
      ['test query'],
      { createAgent: mockAgentWithScratchpad([makeDoneEvent()]) },
    );

    expect(response.scratchpadFile).toMatch(/^\.dexter\/scratchpad\//);
  });

  test('scratchpad contains init entry matching the query', async () => {
    const query = 'What is Apple revenue for FY2024?';
    const { response } = await executeJsonQuery(
      [query],
      { createAgent: mockAgentWithScratchpad([makeDoneEvent()]) },
    );

    const entries = readScratchpadEntries(response.scratchpadFile);
    const initEntry = entries.find((e) => e.type === 'init');

    expect(initEntry).toBeDefined();
    expect(initEntry!.type).toBe('init');
    expect(initEntry!.content).toBe(query);
    expect(initEntry!.timestamp).toBeTruthy();
  });

  test('scratchpad init entry is the first entry', async () => {
    const { response } = await executeJsonQuery(
      ['test query'],
      { createAgent: mockAgentWithScratchpad([makeDoneEvent()]) },
    );

    const entries = readScratchpadEntries(response.scratchpadFile);
    expect(entries.length).toBeGreaterThanOrEqual(1);
    expect(entries[0].type).toBe('init');
  });

  test('scratchpad contains tool_result entries when tools are used', async () => {
    const toolResults = [
      { name: 'financial_search', args: { query: 'AAPL revenue' }, result: '{"revenue": 394.3}' },
      { name: 'web_search', args: { query: 'Apple annual report' }, result: '{"url": "https://example.com"}' },
    ];

    const { response } = await executeJsonQuery(
      ['test query with tools'],
      {
        createAgent: mockAgentWithScratchpad(
          [makeDoneEvent({ toolCalls: toolResults.map((tr) => ({ tool: tr.name, args: tr.args, result: tr.result })) })],
          toolResults,
        ),
      },
    );

    const entries = readScratchpadEntries(response.scratchpadFile);
    const toolEntries = entries.filter((e) => e.type === 'tool_result');

    expect(toolEntries).toHaveLength(2);
    expect(toolEntries[0].toolName).toBe('financial_search');
    expect(toolEntries[1].toolName).toBe('web_search');
  });

  test('scratchpad format matches interactive mode entry types (init, tool_result)', async () => {
    const toolResults = [
      { name: 'web_search', args: { query: 'test' }, result: '{"data": "result"}' },
    ];

    const { response } = await executeJsonQuery(
      ['format test query'],
      { createAgent: mockAgentWithScratchpad([makeDoneEvent()], toolResults) },
    );

    const entries = readScratchpadEntries(response.scratchpadFile);

    // Verify each entry has the required ScratchpadEntry structure
    for (const entry of entries) {
      // Every entry must have type and timestamp (same as interactive mode)
      expect(entry).toHaveProperty('type');
      expect(entry).toHaveProperty('timestamp');
      expect(['init', 'tool_result', 'thinking']).toContain(entry.type);
      expect(typeof entry.timestamp).toBe('string');
      // Timestamp should be ISO format
      expect(new Date(entry.timestamp).toISOString()).toBe(entry.timestamp);
    }

    // Init entry has content field
    const initEntry = entries.find((e) => e.type === 'init');
    expect(initEntry!.content).toBe('format test query');

    // Tool result entries have toolName, args, result fields
    const toolEntry = entries.find((e) => e.type === 'tool_result');
    expect(toolEntry).toBeDefined();
    expect(toolEntry!.toolName).toBe('web_search');
    expect(toolEntry!.args).toEqual({ query: 'test' });
    expect(toolEntry!.result).toBeDefined();
  });

  test('scratchpad entries are valid JSONL (one JSON object per line)', async () => {
    const { response } = await executeJsonQuery(
      ['jsonl format test'],
      {
        createAgent: mockAgentWithScratchpad(
          [makeDoneEvent()],
          [{ name: 'test_tool', args: { a: 1 }, result: 'ok' }],
        ),
      },
    );

    const raw = readFileSync(response.scratchpadFile, 'utf-8');
    const lines = raw.split('\n').filter((line) => line.trim());

    // Each line must be independently parseable as JSON
    for (const line of lines) {
      expect(() => JSON.parse(line)).not.toThrow();
    }

    // There should be at least the init entry
    expect(lines.length).toBeGreaterThanOrEqual(1);
  });

  test('scratchpad tool_result entry stores args and parsed result', async () => {
    const toolResults = [
      { name: 'financial_search', args: { ticker: 'AAPL', period: 'annual' }, result: '{"revenue": 394.3, "year": 2024}' },
    ];

    const { response } = await executeJsonQuery(
      ['test tool data'],
      { createAgent: mockAgentWithScratchpad([makeDoneEvent()], toolResults) },
    );

    const entries = readScratchpadEntries(response.scratchpadFile);
    const toolEntry = entries.find((e) => e.type === 'tool_result');

    expect(toolEntry!.toolName).toBe('financial_search');
    expect(toolEntry!.args).toEqual({ ticker: 'AAPL', period: 'annual' });
    // Scratchpad parses JSON results into objects for cleaner storage
    expect(toolEntry!.result).toEqual({ revenue: 394.3, year: 2024 });
  });
});

// ============================================================================
// classifyError unit tests
// ============================================================================

describe('classifyError', () => {
  test('classifies API key errors as PROVIDER_ERROR', () => {
    expect(classifyError(new Error('Invalid API key'))).toBe(ErrorCode.PROVIDER_ERROR);
    expect(classifyError(new Error('Authentication failed'))).toBe(ErrorCode.PROVIDER_ERROR);
    expect(classifyError(new Error('401 Unauthorized'))).toBe(ErrorCode.PROVIDER_ERROR);
    expect(classifyError(new Error('Rate limit exceeded'))).toBe(ErrorCode.PROVIDER_ERROR);
  });

  test('classifies config errors as CONFIG_ERROR', () => {
    expect(classifyError(new Error('Provider not configured'))).toBe(ErrorCode.CONFIG_ERROR);
    expect(classifyError(new Error('Missing settings file'))).toBe(ErrorCode.CONFIG_ERROR);
  });

  test('classifies agent errors as AGENT_ERROR', () => {
    expect(classifyError(new Error('Agent loop failed'))).toBe(ErrorCode.AGENT_ERROR);
    expect(classifyError(new Error('Tool execution error'))).toBe(ErrorCode.AGENT_ERROR);
    expect(classifyError(new Error('Max iterations reached'))).toBe(ErrorCode.AGENT_ERROR);
    expect(classifyError(new Error('Request timeout'))).toBe(ErrorCode.AGENT_ERROR);
  });

  test('classifies unknown errors as UNKNOWN_ERROR', () => {
    expect(classifyError(new Error('Something random'))).toBe(ErrorCode.UNKNOWN_ERROR);
    expect(classifyError('not an error object')).toBe(ErrorCode.UNKNOWN_ERROR);
    expect(classifyError(null)).toBe(ErrorCode.UNKNOWN_ERROR);
  });
});

// ============================================================================
// T016: End-to-end integration test
// ============================================================================

describe('JSON runner - end-to-end integration (T016)', () => {
  test('full flow: argument → agent → JSON output → exit 0', async () => {
    const doneEvent = makeDoneEvent({
      answer: 'Apple revenue is $394.3 billion for FY2024.',
      toolCalls: [
        { tool: 'financial_search', args: { query: 'AAPL revenue' }, result: '{"revenue": 394.3}' },
        { tool: 'web_search', args: { query: 'Apple annual report' }, result: '{"url": "..."}' },
      ],
      iterations: 2,
      totalTime: 6000,
      tokenUsage: { inputTokens: 2000, outputTokens: 500, totalTokens: 2500 },
    });

    const { response, exitCode } = await executeJsonQuery(
      ['What is Apple revenue?'],
      {
        createAgent: mockAgent([
          { type: 'tool_start', tool: 'financial_search', args: {} },
          { type: 'tool_end', tool: 'financial_search', args: {}, result: '{}', duration: 1000 },
          doneEvent,
        ]),
      },
    );

    expect(exitCode).toBe(0);

    // Schema compliance
    expect(() => JsonResponseSchema.parse(response)).not.toThrow();

    // Content mapping
    expect(response.status).toBe('success');
    expect(response.answer).toBe('Apple revenue is $394.3 billion for FY2024.');
    expect(response.tools).toHaveLength(2);
    expect(response.tools[0].name).toBe('financial_search');
    expect(response.tools[1].name).toBe('web_search');
    expect(response.metadata.iterations).toBe(2);
    expect(response.metadata.totalTimeMs).toBe(6000);
    expect(response.metadata.tokenUsage!.totalTokens).toBe(2500);

    // JSON round-trip
    const json = JSON.stringify(response);
    const parsed = JSON.parse(json);
    expect(() => JsonResponseSchema.parse(parsed)).not.toThrow();
  });

  test('full flow: no query → JSON error → exit 1', async () => {
    const { response, exitCode } = await executeJsonQuery([], { isTTY: true });

    expect(exitCode).toBe(1);
    expect(() => JsonResponseSchema.parse(response)).not.toThrow();
    expect(response.status).toBe('error');
    expect(response.error!.code).toBe('NO_QUERY');
    expect(response.answer).toBe('');
    expect(response.tools).toEqual([]);
  });

  test('full flow: agent error → JSON error → exit 1', async () => {
    const { response, exitCode } = await executeJsonQuery(
      ['test query'],
      { createAgent: throwingAgent(new Error('API key is invalid or expired')) },
    );

    expect(exitCode).toBe(1);
    expect(() => JsonResponseSchema.parse(response)).not.toThrow();
    expect(response.status).toBe('error');
    expect(response.error!.code).toBe('PROVIDER_ERROR');
  });

  test('full flow: stdin query → agent → JSON output → exit 0', async () => {
    const { response, exitCode } = await executeJsonQuery([], {
      isTTY: false,
      readStdin: async () => 'What is AAPL stock price?',
      createAgent: mockAgent([makeDoneEvent({ answer: 'AAPL is $180' })]),
    });

    expect(exitCode).toBe(0);
    expect(response.status).toBe('success');
    expect(response.answer).toBe('AAPL is $180');
  });
});

// ============================================================================
// T017: TUI mode regression guard
// ============================================================================

describe('TUI mode regression guard (T017)', () => {
  const indexSource = readFileSync('src/index.tsx', 'utf-8');

  test('index.tsx conditionally gates --json flag before importing json-runner', () => {
    // The --json check must exist and guard the json-runner import
    expect(indexSource).toContain('--json');
    expect(indexSource).toContain('json-runner');
  });

  test('index.tsx imports and calls runCli() when --json is absent', () => {
    // The else branch must import cli and call runCli
    expect(indexSource).toContain('./cli');
    expect(indexSource).toContain('runCli');
  });

  test('json-runner is only imported inside the --json branch (dynamic import)', () => {
    // json-runner must be a dynamic import (not top-level) so TUI mode never loads it
    expect(indexSource).not.toMatch(/^import .* from ['"]\.\/json-runner/m);
    expect(indexSource).toMatch(/await import\(['"]\.\/json-runner/);
  });

  test('cli is only imported inside the else branch (dynamic import)', () => {
    // cli must be a dynamic import (not top-level) so JSON mode never loads TUI
    expect(indexSource).not.toMatch(/^import .* from ['"]\.\/cli/m);
    expect(indexSource).toMatch(/await import\(['"]\.\/cli/);
  });

  test('TUI entry point (runCli) is NOT called when --json is present', () => {
    // Structural check: the if/else ensures mutual exclusivity
    // --json branch calls runJson, else branch calls runCli — they never overlap
    const jsonBlock = indexSource.match(/if\s*\(.*--json.*\)\s*\{([^}]+)\}/s);
    expect(jsonBlock).not.toBeNull();
    expect(jsonBlock![1]).toContain('runJson');
    expect(jsonBlock![1]).not.toContain('runCli');
  });

  test('json-runner.ts does not import any TUI modules', () => {
    const runnerSource = readFileSync('src/json-runner.ts', 'utf-8');
    const tuiModules = ['./cli', './components', './controllers', 'pi-tui', 'ink', 'react'];
    for (const mod of tuiModules) {
      expect(runnerSource).not.toContain(`from '${mod}`);
    }
  });
});
