import { describe, test, expect, beforeEach, afterEach } from 'bun:test';
import { existsSync, rmSync } from 'fs';
import {
  createSession,
  loadSession,
  saveSession,
  listSessions,
  deleteSession,
  generateSessionId,
  sessionExists,
} from './session-storage.js';

const TEST_SESSIONS_DIR = '.dexter/sessions';

describe('session-storage', () => {
  beforeEach(() => {
    // Clean up before each test
    if (existsSync(TEST_SESSIONS_DIR)) {
      rmSync(TEST_SESSIONS_DIR, { recursive: true, force: true });
    }
  });

  afterEach(() => {
    // Clean up after each test
    if (existsSync(TEST_SESSIONS_DIR)) {
      rmSync(TEST_SESSIONS_DIR, { recursive: true, force: true });
    }
  });

  // ---------------------------------------------------------------------------
  // generateSessionId
  // ---------------------------------------------------------------------------

  describe('generateSessionId', () => {
    test('generates a session ID with session- prefix', () => {
      const id = generateSessionId();
      expect(id).toMatch(/^session-/);
    });

    test('generates unique IDs when called at different times', async () => {
      const id1 = generateSessionId();
      // Wait a bit to ensure different timestamp
      await new Promise((resolve) => setTimeout(resolve, 1100));
      const id2 = generateSessionId();
      expect(id1).not.toBe(id2);
    });
  });

  // ---------------------------------------------------------------------------
  // createSession
  // ---------------------------------------------------------------------------

  describe('createSession', () => {
    test('creates a new session with empty messages', () => {
      const session = createSession('test-session', 'gpt-4', 'openai');

      expect(session.id).toBe('test-session');
      expect(session.messages).toEqual([]);
      expect(session.model).toBe('gpt-4');
      expect(session.provider).toBe('openai');
      expect(session.createdAt).toBeDefined();
      expect(session.updatedAt).toBeDefined();
    });

    test('creates session directory and file', () => {
      createSession('test-session-2', 'claude-3', 'anthropic');

      expect(existsSync('.dexter/sessions/test-session-2/session.json')).toBe(true);
    });
  });

  // ---------------------------------------------------------------------------
  // loadSession
  // ---------------------------------------------------------------------------

  describe('loadSession', () => {
    test('loads an existing session', () => {
      createSession('load-test', 'gpt-4', 'openai');
      const loaded = loadSession('load-test');

      expect(loaded).not.toBeNull();
      expect(loaded!.id).toBe('load-test');
      expect(loaded!.model).toBe('gpt-4');
      expect(loaded!.provider).toBe('openai');
    });

    test('returns null for non-existent session', () => {
      const loaded = loadSession('non-existent');
      expect(loaded).toBeNull();
    });
  });

  // ---------------------------------------------------------------------------
  // sessionExists
  // ---------------------------------------------------------------------------

  describe('sessionExists', () => {
    test('returns true for existing session', () => {
      createSession('exists-test', 'gpt-4', 'openai');
      expect(sessionExists('exists-test')).toBe(true);
    });

    test('returns false for non-existent session', () => {
      expect(sessionExists('does-not-exist')).toBe(false);
    });
  });

  // ---------------------------------------------------------------------------
  // saveSession
  // ---------------------------------------------------------------------------

  describe('saveSession', () => {
    test('saves updated messages to existing session', async () => {
      createSession('save-test', 'gpt-4', 'openai');

      // Wait a bit to ensure timestamp difference
      await new Promise((resolve) => setTimeout(resolve, 1100));

      const messages = [
        { id: 0, query: 'Hello', answer: 'Hi there!', summary: 'Greeting' },
        { id: 1, query: 'How are you?', answer: 'I am good!', summary: 'Status update' },
      ];

      const saved = saveSession('save-test', {
        messages,
        model: 'gpt-4',
        provider: 'openai',
      });

      expect(saved).not.toBeNull();
      expect(saved!.messages).toEqual(messages);
      expect(saved!.updatedAt).not.toEqual(saved!.createdAt);
    });

    test('returns null for non-existent session', () => {
      const saved = saveSession('non-existent', {
        messages: [],
        model: 'gpt-4',
        provider: 'openai',
      });
      expect(saved).toBeNull();
    });
  });

  // ---------------------------------------------------------------------------
  // listSessions
  // ---------------------------------------------------------------------------

  describe('listSessions', () => {
    test('returns empty array when no sessions exist', () => {
      const sessions = listSessions();
      expect(sessions).toEqual([]);
    });

    test('lists all sessions sorted by updatedAt descending', async () => {
      // Create older session
      createSession('older-session', 'gpt-4', 'openai');

      // Wait a bit to ensure different timestamp
      await new Promise((resolve) => setTimeout(resolve, 1100));

      // Create newer session
      createSession('newer-session', 'claude-3', 'anthropic');

      const sessions = listSessions();

      expect(sessions.length).toBe(2);
      // Newer should be first
      expect(sessions[0]!.id).toBe('newer-session');
      expect(sessions[1]!.id).toBe('older-session');
    });

    test('returns correct message count', () => {
      createSession('count-test', 'gpt-4', 'openai');

      const messages = [
        { id: 0, query: 'Q1', answer: 'A1', summary: 'S1' },
        { id: 1, query: 'Q2', answer: 'A2', summary: 'S2' },
        { id: 2, query: 'Q3', answer: 'A3', summary: 'S3' },
      ];

      saveSession('count-test', {
        messages,
        model: 'gpt-4',
        provider: 'openai',
      });

      const sessions = listSessions();
      expect(sessions[0]!.messageCount).toBe(3);
    });
  });

  // ---------------------------------------------------------------------------
  // deleteSession
  // ---------------------------------------------------------------------------

  describe('deleteSession', () => {
    test('deletes an existing session', () => {
      createSession('delete-test', 'gpt-4', 'openai');
      expect(sessionExists('delete-test')).toBe(true);

      const deleted = deleteSession('delete-test');
      expect(deleted).toBe(true);
      expect(sessionExists('delete-test')).toBe(false);
    });

    test('returns false for non-existent session', () => {
      const deleted = deleteSession('non-existent');
      expect(deleted).toBe(false);
    });
  });

  // ---------------------------------------------------------------------------
  // round-trip test
  // ---------------------------------------------------------------------------

  describe('round-trip', () => {
    test('full create -> save -> load -> verify cycle', () => {
      // 1. Create session
      const sessionId = 'round-trip-test';
      createSession(sessionId, 'gpt-4', 'openai');

      // 2. Add messages
      const messages = [
        { id: 0, query: 'What is AAPL?', answer: 'Apple Inc.', summary: 'Apple company info' },
        { id: 1, query: 'Show me the price', answer: '$150.00', summary: 'Stock price' },
      ];

      saveSession(sessionId, {
        messages,
        model: 'gpt-4',
        provider: 'openai',
      });

      // 3. Load and verify
      const loaded = loadSession(sessionId);
      expect(loaded).not.toBeNull();
      expect(loaded!.messages).toEqual(messages);
      expect(loaded!.model).toBe('gpt-4');
      expect(loaded!.provider).toBe('openai');

      // 4. Add more messages
      const moreMessages = [
        ...messages,
        { id: 2, query: 'What about GOOGL?', answer: 'Alphabet Inc.', summary: 'Google company info' },
      ];

      saveSession(sessionId, {
        messages: moreMessages,
        model: 'gpt-4',
        provider: 'openai',
      });

      // 5. Load again and verify
      const reloaded = loadSession(sessionId);
      expect(reloaded!.messages.length).toBe(3);
    });
  });
});
