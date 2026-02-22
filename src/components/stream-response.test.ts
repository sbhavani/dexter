import { describe, expect, test, vi, beforeEach } from 'bun:test';
import { StreamResponse, createStreamResponse } from '../components/stream-response';

describe('StreamResponse', () => {
  let outputBuffer: string[] = [];
  let mockOutput: {
    write: (text: string) => boolean;
    flush?: () => void;
  };

  beforeEach(() => {
    outputBuffer = [];
    mockOutput = {
      write: (text: string) => {
        outputBuffer.push(text);
        return true;
      },
      flush: vi.fn(),
    };
  });

  test('should not output anything when disabled', () => {
    const stream = createStreamResponse({
      enabled: false,
      output: mockOutput as any,
    });

    stream.onToken('Hello', 'answer', false);
    stream.onToken(' world', 'answer', false);
    stream.onToken('', 'answer', true);

    expect(outputBuffer).toEqual([]);
  });

  test('should stream tokens when enabled', () => {
    const stream = createStreamResponse({
      enabled: true,
      output: mockOutput as any,
    });

    stream.onToken('Hello', 'answer', false);
    stream.onToken(' world', 'answer', false);
    stream.onToken('', 'answer', true);

    expect(outputBuffer.length).toBeGreaterThan(0);
    expect(outputBuffer.join('')).toContain('Hello');
    expect(outputBuffer.join('')).toContain('world');
  });

  test('should differentiate thinking and answer streams', () => {
    const stream = createStreamResponse({
      enabled: true,
      output: mockOutput as any,
      showThinking: true,
    });

    stream.onToken('Analyzing', 'thinking', false);
    stream.onToken('', 'thinking', true);
    stream.onToken('The answer', 'answer', false);
    stream.onToken('', 'answer', true);

    const fullOutput = outputBuffer.join('');
    // Thinking should be in cyan
    expect(fullOutput).toContain('Analyzing');
    // Answer should be in green
    expect(fullOutput).toContain('The answer');
  });

  test('should handle done state correctly', () => {
    const stream = createStreamResponse({
      enabled: true,
      output: mockOutput as any,
    });

    stream.onToken('Test', 'answer', true);

    expect(stream).toBeDefined();
  });

  test('should reset state correctly', () => {
    const stream = createStreamResponse({
      enabled: true,
      output: mockOutput as any,
    });

    stream.onToken('Hello', 'answer', false);
    stream.reset();

    // After reset, should be able to stream again
    stream.onToken('World', 'answer', false);

    expect(outputBuffer.join('')).toContain('World');
  });

  test('printThinking should work when enabled', () => {
    const stream = createStreamResponse({
      enabled: true,
      output: mockOutput as any,
      showThinking: true,
    });

    stream.printThinking('Analyzing the data...');

    expect(outputBuffer.length).toBeGreaterThan(0);
    expect(outputBuffer.join('')).toContain('Analyzing the data...');
  });

  test('printThinking should not output when showThinking is false', () => {
    const stream = createStreamResponse({
      enabled: true,
      output: mockOutput as any,
      showThinking: false,
    });

    stream.printThinking('Thinking...');

    expect(outputBuffer).toEqual([]);
  });

  test('printToolStart should output tool info', () => {
    const stream = createStreamResponse({
      enabled: true,
      output: mockOutput as any,
    });

    stream.printToolStart('web_search', { query: 'test' });

    expect(outputBuffer.join('')).toContain('web_search');
  });

  test('printToolResult should output result', () => {
    const stream = createStreamResponse({
      enabled: true,
      output: mockOutput as any,
    });

    stream.printToolResult('web_search', 'Search result', 150);

    expect(outputBuffer.join('')).toContain('Search result');
    expect(outputBuffer.join('')).toContain('150');
  });

  test('isEnabled should return correct state', () => {
    const disabledStream = createStreamResponse({ enabled: false });
    const enabledStream = createStreamResponse({ enabled: true });

    expect(disabledStream.isEnabled()).toBe(false);
    expect(enabledStream.isEnabled()).toBe(true);
  });

  test('setEnabled should toggle state', () => {
    const stream = createStreamResponse({ enabled: false, output: mockOutput as any });

    expect(stream.isEnabled()).toBe(false);

    stream.setEnabled(true);
    expect(stream.isEnabled()).toBe(true);
  });
});
