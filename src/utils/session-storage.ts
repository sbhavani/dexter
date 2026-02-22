import { readFile, writeFile, mkdir } from 'fs/promises';
import { existsSync, readFileSync } from 'fs';
import { join } from 'path';

const DEXTER_DIR = '.dexter';
const SESSIONS_DIR = 'sessions';

/**
 * Message interface for session storage (mirrors InMemoryChatHistory.Message)
 */
export interface StoredMessage {
  id: number;
  query: string;
  answer: string | null;
  summary: string | null;
}

interface SessionData {
  id: string;
  createdAt: string;
  updatedAt: string;
  messages: StoredMessage[];
}

interface SessionIndex {
  sessions: SessionMeta[];
}

interface SessionMeta {
  id: string;
  createdAt: string;
  updatedAt: string;
  messageCount: number;
}

function getSessionsDir(baseDir: string = process.cwd()): string {
  return join(baseDir, DEXTER_DIR, SESSIONS_DIR);
}

function getSessionDir(baseDir: string = process.cwd(), sessionId: string): string {
  return join(getSessionsDir(baseDir), sessionId);
}

function getSessionFile(baseDir: string = process.cwd(), sessionId: string): string {
  return join(getSessionDir(baseDir, sessionId), 'conversation.json');
}

function getIndexFile(baseDir: string = process.cwd()): string {
  return join(getSessionsDir(baseDir), 'index.json');
}

/**
 * Lists all saved sessions (prints to console)
 */
export function listSessions(baseDir: string = process.cwd()): void {
  const indexFile = getIndexFile(baseDir);

  if (!existsSync(indexFile)) {
    console.log('No saved sessions found.');
    return;
  }

  try {
    const content = readFileSync(indexFile, 'utf-8');
    const index: SessionIndex = JSON.parse(content);
    const sessions = index.sessions.sort(
      (a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime()
    );

    if (sessions.length === 0) {
      console.log('No saved sessions found.');
      return;
    }

    console.log('Saved sessions:\n');
    for (const session of sessions) {
      const created = new Date(session.createdAt).toLocaleDateString();
      const updated = new Date(session.updatedAt).toLocaleString();
      console.log(`  ${session.id}`);
      console.log(`    Created: ${created}, Last updated: ${updated}`);
      console.log(`    Messages: ${session.messageCount}`);
      console.log('');
    }
  } catch {
    console.log('No saved sessions found.');
  }
}

/**
 * Saves a session to disk
 */
export async function saveSession(
  sessionId: string,
  messages: StoredMessage[],
  baseDir: string = process.cwd()
): Promise<void> {
  const sessionDir = getSessionDir(baseDir, sessionId);
  const sessionFile = getSessionFile(baseDir, sessionId);
  const indexFile = getIndexFile(baseDir);

  // Create session directory
  if (!existsSync(sessionDir)) {
    await mkdir(sessionDir, { recursive: true });
  }

  const now = new Date().toISOString();

  // Save session data
  const sessionData: SessionData = {
    id: sessionId,
    createdAt: now,
    updatedAt: now,
    messages,
  };

  await writeFile(sessionFile, JSON.stringify(sessionData, null, 2), 'utf-8');

  // Update index
  let index: SessionIndex = { sessions: [] };
  if (existsSync(indexFile)) {
    try {
      const content = await readFile(indexFile, 'utf-8');
      index = JSON.parse(content);
    } catch {
      index = { sessions: [] };
    }
  }

  const existingIndex = index.sessions.findIndex((s) => s.id === sessionId);
  const sessionMeta: SessionMeta = {
    id: sessionId,
    createdAt: existingIndex >= 0 ? index.sessions[existingIndex].createdAt : now,
    updatedAt: now,
    messageCount: messages.length,
  };

  if (existingIndex >= 0) {
    index.sessions[existingIndex] = sessionMeta;
  } else {
    index.sessions.push(sessionMeta);
  }

  await writeFile(indexFile, JSON.stringify(index, null, 2), 'utf-8');
}

/**
 * Loads a session from disk
 */
export async function loadSession(
  sessionId: string,
  baseDir: string = process.cwd()
): Promise<StoredMessage[] | null> {
  const sessionFile = getSessionFile(baseDir, sessionId);

  if (!existsSync(sessionFile)) {
    return null;
  }

  try {
    const content = await readFile(sessionFile, 'utf-8');
    const sessionData: SessionData = JSON.parse(content);
    return sessionData.messages;
  } catch {
    return null;
  }
}

/**
 * Checks if a session exists
 */
export function sessionExists(sessionId: string, baseDir: string = process.cwd()): boolean {
  const sessionFile = getSessionFile(baseDir, sessionId);
  return existsSync(sessionFile);
}

/**
 * Deletes a session from disk
 */
export async function deleteSession(
  sessionId: string,
  baseDir: string = process.cwd()
): Promise<boolean> {
  const sessionDir = getSessionDir(baseDir, sessionId);
  const indexFile = getIndexFile(baseDir);

  if (!existsSync(sessionDir)) {
    return false;
  }

  try {
    // Remove session files
    const { rm } = await import('fs/promises');
    await rm(sessionDir, { recursive: true, force: true });

    // Update index
    if (existsSync(indexFile)) {
      const content = await readFile(indexFile, 'utf-8');
      const index: SessionIndex = JSON.parse(content);
      index.sessions = index.sessions.filter((s) => s.id !== sessionId);
      await writeFile(indexFile, JSON.stringify(index, null, 2), 'utf-8');
    }

    return true;
  } catch {
    return false;
  }
}
