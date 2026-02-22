import { describe, expect, test } from 'bun:test';
import { mkdtempSync, rmSync, existsSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { SessionManager } from './session-manager.js';
import { SessionStore } from './session-store.js';
import { SessionHistory } from './session-history.js';

function makeExchangeInput(query: string, answer: string) {
  return {
    query,
    answer,
    summary: `Summary: ${answer}`,
    model: 'test-model',
    status: 'complete' as const,
    duration: 1000,
    tokenUsage: { inputTokens: 100, outputTokens: 50, totalTokens: 150 },
  };
}

describe('SessionManager', () => {
  function createManager() {
    const dir = mkdtempSync(join(tmpdir(), 'dexter-session-mgr-'));
    return { manager: new SessionManager(dir), dir };
  }

  test('startNew creates index entry', () => {
    const { manager, dir } = createManager();
    try {
      const meta = manager.startNew('test-model', 'test-provider');
      expect(meta.id).toMatch(/^[a-z0-9]{8}$/);
      expect(meta.model).toBe('test-model');
      expect(meta.provider).toBe('test-provider');
      expect(meta.exchangeCount).toBe(0);

      // Verify persisted
      const store = new SessionStore(dir);
      expect(store.get(meta.id)).not.toBeNull();
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });

  test('saveExchange appends to JSONL and updates metadata', () => {
    const { manager, dir } = createManager();
    try {
      const meta = manager.startNew('test-model', 'test');
      manager.saveExchange(makeExchangeInput('What is AAPL?', 'AAPL is Apple Inc.'));

      // Check JSONL
      const history = new SessionHistory(meta.id, dir);
      const exchanges = history.load();
      expect(exchanges).toHaveLength(1);
      expect(exchanges[0].query).toBe('What is AAPL?');

      // Check metadata updated
      const store = new SessionStore(dir);
      const updated = store.get(meta.id)!;
      expect(updated.exchangeCount).toBe(1);
      expect(updated.firstQuery).toBe('What is AAPL?');
      expect(updated.lastQuery).toBe('What is AAPL?');
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });

  test('multiple exchanges increment count', () => {
    const { manager, dir } = createManager();
    try {
      const meta = manager.startNew('test-model', 'test');
      manager.saveExchange(makeExchangeInput('Query 1', 'Answer 1'));
      manager.saveExchange(makeExchangeInput('Query 2', 'Answer 2'));
      manager.saveExchange(makeExchangeInput('Query 3', 'Answer 3'));

      const store = new SessionStore(dir);
      const updated = store.get(meta.id)!;
      expect(updated.exchangeCount).toBe(3);
      expect(updated.firstQuery).toBe('Query 1');
      expect(updated.lastQuery).toBe('Query 3');

      const history = new SessionHistory(meta.id, dir);
      expect(history.load()).toHaveLength(3);
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });

  test('resume loads exchanges', () => {
    const { manager, dir } = createManager();
    try {
      const meta = manager.startNew('test-model', 'test');
      manager.saveExchange(makeExchangeInput('Q1', 'A1'));
      manager.saveExchange(makeExchangeInput('Q2', 'A2'));

      // Create new manager to simulate app restart
      const manager2 = new SessionManager(dir);
      const mockChatHistory = {
        saveUserQuery: () => {},
        getMessages: () => [] as any[],
      };
      const result = manager2.resume(meta.id, mockChatHistory as any);
      expect(result.metadata.id).toBe(meta.id);
      expect(result.exchanges).toHaveLength(2);
      expect(result.exchanges[0].query).toBe('Q1');
      expect(result.exchanges[1].query).toBe('Q2');
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });

  test('resume with non-existent ID throws error', () => {
    const { manager, dir } = createManager();
    try {
      const mockChatHistory = {
        saveUserQuery: () => {},
        getMessages: () => [] as any[],
      };
      expect(() => manager.resume('nope1234', mockChatHistory as any)).toThrow(
        'Session "nope1234" not found.',
      );
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });

  test('resumed session continues saving new exchanges', () => {
    const { manager, dir } = createManager();
    try {
      const meta = manager.startNew('test-model', 'test');
      manager.saveExchange(makeExchangeInput('Q1', 'A1'));

      // Simulate restart + resume
      const manager2 = new SessionManager(dir);
      const mockChatHistory = {
        saveUserQuery: () => {},
        getMessages: () => [] as any[],
      };
      manager2.resume(meta.id, mockChatHistory as any);
      manager2.saveExchange(makeExchangeInput('Q2', 'A2'));

      const history = new SessionHistory(meta.id, dir);
      expect(history.load()).toHaveLength(2);

      const store = new SessionStore(dir);
      expect(store.get(meta.id)!.exchangeCount).toBe(2);
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });

  describe('listSessions', () => {
    test('returns empty array when no sessions', () => {
      const { manager, dir } = createManager();
      try {
        const list = manager.listSessions();
        expect(list).toEqual([]);
      } finally {
        rmSync(dir, { recursive: true, force: true });
      }
    });

    test('returns all sessions sorted by updatedAt desc', () => {
      const dir = mkdtempSync(join(tmpdir(), 'dexter-session-mgr-'));
      try {
        // Create 3 sessions with different updatedAt values
        const mgr1 = new SessionManager(dir);
        const meta1 = mgr1.startNew('model1', 'prov1');

        const mgr2 = new SessionManager(dir);
        const meta2 = mgr2.startNew('model2', 'prov2');

        const mgr3 = new SessionManager(dir);
        const meta3 = mgr3.startNew('model3', 'prov3');

        // Save an exchange on the first session so its updatedAt is newest
        mgr1.saveExchange(makeExchangeInput('Latest query', 'Latest answer'));

        const reader = new SessionManager(dir);
        const list = reader.listSessions();
        expect(list).toHaveLength(3);

        // First session should now be most recent (it got an exchange saved)
        expect(list[0].id).toBe(meta1.id);

        // Remaining two should be in desc order by updatedAt
        for (let i = 0; i < list.length - 1; i++) {
          expect(list[i].updatedAt).toBeGreaterThanOrEqual(list[i + 1].updatedAt);
        }
      } finally {
        rmSync(dir, { recursive: true, force: true });
      }
    });

    test('list reflects creates and deletes', () => {
      const dir = mkdtempSync(join(tmpdir(), 'dexter-session-mgr-'));
      try {
        const mgr = new SessionManager(dir);
        expect(mgr.listSessions()).toHaveLength(0);

        // Create two sessions
        const meta1 = mgr.startNew('model1', 'prov1');
        const mgr2 = new SessionManager(dir);
        const meta2 = mgr2.startNew('model2', 'prov2');

        const reader1 = new SessionManager(dir);
        expect(reader1.listSessions()).toHaveLength(2);

        // Delete one session
        const deleter = new SessionManager(dir);
        deleter.deleteSession(meta1.id);

        const reader2 = new SessionManager(dir);
        const afterDelete = reader2.listSessions();
        expect(afterDelete).toHaveLength(1);
        expect(afterDelete[0].id).toBe(meta2.id);

        // Create a third session
        const mgr3 = new SessionManager(dir);
        mgr3.startNew('model3', 'prov3');

        const reader3 = new SessionManager(dir);
        expect(reader3.listSessions()).toHaveLength(2);
      } finally {
        rmSync(dir, { recursive: true, force: true });
      }
    });
  });

  test('deleteSession removes session and history directory', () => {
    const { manager, dir } = createManager();
    try {
      const meta = manager.startNew('test-model', 'test');
      manager.saveExchange(makeExchangeInput('Q1', 'A1'));

      const sessionDir = join(dir, '.dexter', 'sessions', 'cli', meta.id);
      expect(existsSync(sessionDir)).toBe(true);

      const manager2 = new SessionManager(dir);
      const deleted = manager2.deleteSession(meta.id);
      expect(deleted).toBe(true);
      expect(existsSync(sessionDir)).toBe(false);

      const store = new SessionStore(dir);
      expect(store.get(meta.id)).toBeNull();
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });

  test('deleteSession returns false for non-existent session', () => {
    const { manager, dir } = createManager();
    try {
      expect(manager.deleteSession('nope1234')).toBe(false);
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });

  test('deleted session does not appear in listSessions', () => {
    const dir = mkdtempSync(join(tmpdir(), 'dexter-session-mgr-'));
    try {
      const mgr1 = new SessionManager(dir);
      const meta1 = mgr1.startNew('model1', 'prov1');

      const mgr2 = new SessionManager(dir);
      const meta2 = mgr2.startNew('model2', 'prov2');

      const mgr3 = new SessionManager(dir);
      expect(mgr3.listSessions()).toHaveLength(2);

      mgr3.deleteSession(meta1.id);

      const remaining = mgr3.listSessions();
      expect(remaining).toHaveLength(1);
      expect(remaining[0].id).toBe(meta2.id);
      expect(remaining.find((s) => s.id === meta1.id)).toBeUndefined();
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });
});
