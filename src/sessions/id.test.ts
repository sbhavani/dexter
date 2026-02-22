import { describe, expect, test } from 'bun:test';
import { generateSessionId } from './id.js';

describe('generateSessionId', () => {
  test('returns an 8-character string', () => {
    const id = generateSessionId();
    expect(id).toHaveLength(8);
  });

  test('contains only lowercase alphanumeric characters', () => {
    for (let i = 0; i < 100; i++) {
      const id = generateSessionId();
      expect(id).toMatch(/^[a-z0-9]{8}$/);
    }
  });

  test('generates unique IDs across 1000 calls', () => {
    const ids = new Set<string>();
    for (let i = 0; i < 1000; i++) {
      ids.add(generateSessionId());
    }
    expect(ids.size).toBe(1000);
  });
});
