import { describe, expect, test } from 'bun:test';
import { mkdtempSync, rmSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { SessionStore } from './session-store.js';
import type { SessionMetadata } from './types.js';

function makeMeta(id: string, overrides?: Partial<SessionMetadata>): SessionMetadata {
  const now = Date.now();
  return {
    id,
    createdAt: now,
    updatedAt: now,
    exchangeCount: 0,
    model: 'test-model',
    provider: 'test',
    firstQuery: '',
    lastQuery: '',
    ...overrides,
  };
}

describe('SessionStore', () => {
  function createStore() {
    const dir = mkdtempSync(join(tmpdir(), 'dexter-session-store-'));
    return { store: new SessionStore(dir), dir };
  }

  test('load returns empty index when no file exists', () => {
    const { store, dir } = createStore();
    try {
      const index = store.load();
      expect(index.version).toBe(1);
      expect(Object.keys(index.sessions)).toHaveLength(0);
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });

  test('create and get session by ID', () => {
    const { store, dir } = createStore();
    try {
      const meta = makeMeta('abcd1234', { firstQuery: 'Hello' });
      store.create(meta);
      const result = store.get('abcd1234');
      expect(result).not.toBeNull();
      expect(result!.id).toBe('abcd1234');
      expect(result!.firstQuery).toBe('Hello');
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });

  test('get returns null for non-existent ID', () => {
    const { store, dir } = createStore();
    try {
      expect(store.get('nope1234')).toBeNull();
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });

  test('list returns all sessions sorted by updatedAt desc', () => {
    const { store, dir } = createStore();
    try {
      store.create(makeMeta('aaaa1111', { updatedAt: 100 }));
      store.create(makeMeta('bbbb2222', { updatedAt: 300 }));
      store.create(makeMeta('cccc3333', { updatedAt: 200 }));

      const list = store.list();
      expect(list).toHaveLength(3);
      expect(list[0].id).toBe('bbbb2222');
      expect(list[1].id).toBe('cccc3333');
      expect(list[2].id).toBe('aaaa1111');
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });

  test('update modifies metadata fields', () => {
    const { store, dir } = createStore();
    try {
      store.create(makeMeta('abcd1234', { exchangeCount: 0 }));
      store.update('abcd1234', { exchangeCount: 5, lastQuery: 'Updated' });

      const result = store.get('abcd1234');
      expect(result!.exchangeCount).toBe(5);
      expect(result!.lastQuery).toBe('Updated');
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });

  test('delete removes session from index', () => {
    const { store, dir } = createStore();
    try {
      store.create(makeMeta('abcd1234'));
      expect(store.get('abcd1234')).not.toBeNull();

      const deleted = store.delete('abcd1234');
      expect(deleted).toBe(true);
      expect(store.get('abcd1234')).toBeNull();
      expect(store.list()).toHaveLength(0);
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });

  test('delete returns false for non-existent session', () => {
    const { store, dir } = createStore();
    try {
      expect(store.delete('nope1234')).toBe(false);
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });

  test('load creates file on first save', () => {
    const { store, dir } = createStore();
    try {
      store.create(makeMeta('abcd1234'));
      // Reload from disk
      const store2 = new SessionStore(dir);
      const result = store2.get('abcd1234');
      expect(result).not.toBeNull();
      expect(result!.id).toBe('abcd1234');
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });
});
