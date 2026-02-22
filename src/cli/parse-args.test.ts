import { describe, test, expect } from 'bun:test';
import { parseArgs } from './parse-args';

describe('parseArgs', () => {
  test('no args returns json: false', () => {
    const result = parseArgs([]);
    expect(result).toEqual({ json: false, model: undefined, query: undefined });
  });

  test('--json flag sets json: true', () => {
    const result = parseArgs(['--json']);
    expect(result.json).toBe(true);
    expect(result.query).toBeUndefined();
  });

  test('--json with query string', () => {
    const result = parseArgs(['--json', 'hello world']);
    expect(result).toEqual({ json: true, model: undefined, query: 'hello world' });
  });

  test('--json with --model flag', () => {
    const result = parseArgs(['--json', '--model', 'claude-sonnet-4-20250514']);
    expect(result.json).toBe(true);
    expect(result.model).toBe('claude-sonnet-4-20250514');
    expect(result.query).toBeUndefined();
  });

  test('multi-word query joined with spaces', () => {
    const result = parseArgs(['--json', 'What', 'is', 'PE?']);
    expect(result.json).toBe(true);
    expect(result.query).toBe('What is PE?');
  });

  test('--model without value results in model undefined', () => {
    const result = parseArgs(['--json', '--model']);
    expect(result.json).toBe(true);
    expect(result.model).toBeUndefined();
  });

  test('query without --json', () => {
    const result = parseArgs(['hello']);
    expect(result.json).toBe(false);
    expect(result.query).toBe('hello');
  });

  test('--json with --model and query', () => {
    const result = parseArgs(['--json', '--model', 'gpt-5.2', 'What is AAPL?']);
    expect(result.json).toBe(true);
    expect(result.model).toBe('gpt-5.2');
    expect(result.query).toBe('What is AAPL?');
  });
});
