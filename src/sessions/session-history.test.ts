import { describe, expect, test } from 'bun:test';
import { mkdtempSync, rmSync, writeFileSync, mkdirSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { SessionHistory } from './session-history.js';
import type { SessionExchange } from './types.js';

function makeExchange(id: string, query: string): SessionExchange {
  return {
    id,
    timestamp: Date.now(),
    query,
    answer: `Answer to ${query}`,
    summary: `Summary of ${query}`,
    model: 'test-model',
    status: 'complete',
    duration: 1000,
    tokenUsage: { inputTokens: 100, outputTokens: 50, totalTokens: 150 },
  };
}

describe('SessionHistory', () => {
  function createHistory(sessionId = 'test1234') {
    const dir = mkdtempSync(join(tmpdir(), 'dexter-session-history-'));
    return { history: new SessionHistory(sessionId, dir), dir };
  }

  test('load returns empty array when no file exists', () => {
    const { history, dir } = createHistory();
    try {
      expect(history.load()).toEqual([]);
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });

  test('append creates directory and writes JSONL line', () => {
    const { history, dir } = createHistory();
    try {
      const exchange = makeExchange('1', 'What is AAPL?');
      history.append(exchange);

      const loaded = history.load();
      expect(loaded).toHaveLength(1);
      expect(loaded[0].query).toBe('What is AAPL?');
      expect(loaded[0].answer).toBe('Answer to What is AAPL?');
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });

  test('append writes multiple exchanges as separate lines', () => {
    const { history, dir } = createHistory();
    try {
      history.append(makeExchange('1', 'Query 1'));
      history.append(makeExchange('2', 'Query 2'));
      history.append(makeExchange('3', 'Query 3'));

      const loaded = history.load();
      expect(loaded).toHaveLength(3);
      expect(loaded[0].query).toBe('Query 1');
      expect(loaded[2].query).toBe('Query 3');
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });

  test('load skips malformed lines gracefully', () => {
    const dir = mkdtempSync(join(tmpdir(), 'dexter-session-history-'));
    const historyDir = join(dir, '.dexter', 'sessions', 'cli', 'test1234');
    mkdirSync(historyDir, { recursive: true });

    const filePath = join(historyDir, 'history.jsonl');
    const validExchange = makeExchange('1', 'Valid query');
    const lines = [
      JSON.stringify(validExchange),
      'this is not valid json',
      '{"incomplete": true}',
      JSON.stringify(makeExchange('2', 'Another valid')),
    ];
    writeFileSync(filePath, lines.join('\n') + '\n');

    try {
      const history = new SessionHistory('test1234', dir);
      const loaded = history.load();
      expect(loaded).toHaveLength(2);
      expect(loaded[0].query).toBe('Valid query');
      expect(loaded[1].query).toBe('Another valid');
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });

  test('empty file returns empty array', () => {
    const dir = mkdtempSync(join(tmpdir(), 'dexter-session-history-'));
    const historyDir = join(dir, '.dexter', 'sessions', 'cli', 'test1234');
    mkdirSync(historyDir, { recursive: true });
    writeFileSync(join(historyDir, 'history.jsonl'), '');

    try {
      const history = new SessionHistory('test1234', dir);
      expect(history.load()).toEqual([]);
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });
});
