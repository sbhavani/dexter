import { existsSync, readFileSync, writeFileSync, mkdirSync, readdirSync, statSync } from 'fs';
import { join, dirname } from 'path';
import type { Message } from './in-memory-chat-history.js';

const SESSIONS_DIR = '.dexter/sessions';

/**
 * Session data structure that gets persisted to disk
 */
export interface SessionData {
  id: string;
  createdAt: string;
  updatedAt: string;
  messages: Message[];
  model: string;
  provider: string;
}

/**
 * Session metadata for listing
 */
export interface SessionInfo {
  id: string;
  createdAt: string;
  updatedAt: string;
  messageCount: number;
}

/**
 * Gets the directory path for a session
 */
function getSessionDir(sessionId: string): string {
  return join(SESSIONS_DIR, sessionId);
}

/**
 * Gets the session file path
 */
function getSessionFile(sessionId: string): string {
  return join(getSessionDir(sessionId), 'session.json');
}

/**
 * Ensures the sessions directory exists
 */
function ensureSessionsDir(): void {
  if (!existsSync(SESSIONS_DIR)) {
    mkdirSync(SESSIONS_DIR, { recursive: true });
  }
}

/**
 * Creates a new session with the given ID
 */
export function createSession(sessionId: string, model: string, provider: string): SessionData {
  ensureSessionsDir();

  const now = new Date().toISOString();
  const session: SessionData = {
    id: sessionId,
    createdAt: now,
    updatedAt: now,
    messages: [],
    model,
    provider,
  };

  const dir = getSessionDir(sessionId);
  if (!existsSync(dir)) {
    mkdirSync(dir, { recursive: true });
  }
  writeFileSync(getSessionFile(sessionId), JSON.stringify(session, null, 2));

  return session;
}

/**
 * Saves session data (messages, model, provider)
 */
export function saveSession(sessionId: string, data: { messages: Message[]; model: string; provider: string }): SessionData | null {
  const existing = loadSession(sessionId);
  if (!existing) {
    return null;
  }

  const updated: SessionData = {
    ...existing,
    ...data,
    updatedAt: new Date().toISOString(),
  };

  writeFileSync(getSessionFile(sessionId), JSON.stringify(updated, null, 2));
  return updated;
}

/**
 * Loads a session by ID
 */
export function loadSession(sessionId: string): SessionData | null {
  const filePath = getSessionFile(sessionId);

  if (!existsSync(filePath)) {
    return null;
  }

  try {
    const content = readFileSync(filePath, 'utf-8');
    return JSON.parse(content) as SessionData;
  } catch {
    return null;
  }
}

/**
 * Lists all available sessions
 */
export function listSessions(): SessionInfo[] {
  if (!existsSync(SESSIONS_DIR)) {
    return [];
  }

  const sessions: SessionInfo[] = [];
  const entries = readdirSync(SESSIONS_DIR);

  for (const entry of entries) {
    const dirPath = join(SESSIONS_DIR, entry);
    const stat = statSync(dirPath);

    if (!stat.isDirectory()) {
      continue;
    }

    const session = loadSession(entry);
    if (session) {
      sessions.push({
        id: session.id,
        createdAt: session.createdAt,
        updatedAt: session.updatedAt,
        messageCount: session.messages.length,
      });
    }
  }

  // Sort by updatedAt descending (most recent first)
  sessions.sort((a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime());

  return sessions;
}

/**
 * Deletes a session
 */
export function deleteSession(sessionId: string): boolean {
  const dirPath = getSessionDir(sessionId);

  if (!existsSync(dirPath)) {
    return false;
  }

  try {
    // Use rmSync if available (Node 14.14+), otherwise we'd need a recursive delete
    const { rmSync } = require('fs');
    rmSync(dirPath, { recursive: true, force: true });
    return true;
  } catch {
    return false;
  }
}

/**
 * Generates a new session ID based on timestamp
 */
export function generateSessionId(): string {
  const now = new Date();
  const timestamp = now.toISOString()
    .replace(/[:.]/g, '-')
    .replace('T', '_')
    .slice(0, 19);
  return `session-${timestamp}`;
}

/**
 * Checks if a session exists
 */
export function sessionExists(sessionId: string): boolean {
  return existsSync(getSessionFile(sessionId));
}
