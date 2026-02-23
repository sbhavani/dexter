import { readFile, writeFile, mkdir, readdir, stat } from 'fs/promises';
import { existsSync } from 'fs';
import { join, dirname } from 'path';

/**
 * Represents a single message in a session
 */
export interface SessionMessage {
  id: number;
  query: string;
  answer: string | null;
  summary: string | null;
}

/**
 * Represents a complete session with all its data
 */
export interface Session {
  id: string;
  createdAt: string;
  updatedAt: string;
  model: string;
  provider: string;
  messages: SessionMessage[];
  approvedTools: string[];
}

/**
 * Metadata for listing sessions without loading full content
 */
export interface SessionMeta {
  id: string;
  createdAt: string;
  updatedAt: string;
  messageCount: number;
}

interface SessionFile {
  session: Session;
}

const DEXTER_DIR = '.dexter';
const SESSIONS_DIR = 'sessions';
const SESSION_FILE = 'session.json';

/**
 * Generates a new session ID based on current timestamp
 */
export function generateSessionId(): string {
  const now = new Date();
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, '0');
  const day = String(now.getDate()).padStart(2, '0');
  const hours = String(now.getHours()).padStart(2, '0');
  const minutes = String(now.getMinutes()).padStart(2, '0');
  const seconds = String(now.getSeconds()).padStart(2, '0');
  return `${year}${month}${day}-${hours}${minutes}${seconds}`;
}

/**
 * Manages persistent storage of conversation sessions.
 * Stores sessions in .dexter/sessions/{session-id}/session.json
 */
export class SessionStore {
  private baseDir: string;
  private currentSession: Session | null = null;
  private sessionDir: string;

  constructor(baseDir: string = process.cwd()) {
    this.baseDir = baseDir;
    this.sessionDir = join(baseDir, DEXTER_DIR, SESSIONS_DIR);
  }

  /**
   * Gets the directory path for a specific session
   */
  private getSessionPath(sessionId: string): string {
    return join(this.sessionDir, sessionId);
  }

  /**
   * Gets the file path for a specific session
   */
  private getSessionFilePath(sessionId: string): string {
    return join(this.getSessionPath(sessionId), SESSION_FILE);
  }

  /**
   * Creates a new session with the given model and provider
   */
  async createSession(model: string, provider: string): Promise<Session> {
    const id = generateSessionId();
    const now = new Date().toISOString();

    const session: Session = {
      id,
      createdAt: now,
      updatedAt: now,
      model,
      provider,
      messages: [],
      approvedTools: [],
    };

    await this.saveSession(session);
    this.currentSession = session;
    return session;
  }

  /**
   * Loads an existing session by ID
   */
  async loadSession(sessionId: string): Promise<Session | null> {
    const filePath = this.getSessionFilePath(sessionId);

    if (!existsSync(filePath)) {
      return null;
    }

    try {
      const content = await readFile(filePath, 'utf-8');
      const data: SessionFile = JSON.parse(content);
      this.currentSession = data.session;
      return data.session;
    } catch {
      return null;
    }
  }

  /**
   * Saves the current session to disk
   */
  async saveSession(session: Session): Promise<void> {
    const dir = this.getSessionPath(session.id);
    const filePath = this.getSessionFilePath(session.id);

    if (!existsSync(dir)) {
      await mkdir(dir, { recursive: true });
    }

    session.updatedAt = new Date().toISOString();

    const data: SessionFile = { session };
    await writeFile(filePath, JSON.stringify(data, null, 2), 'utf-8');
  }

  /**
   * Gets the current session (if any)
   */
  getCurrentSession(): Session | null {
    return this.currentSession;
  }

  /**
   * Updates the current session with new messages
   */
  async updateSession(
    messages: SessionMessage[],
    approvedTools: string[],
    model?: string,
    provider?: string,
  ): Promise<void> {
    if (!this.currentSession) {
      return;
    }

    this.currentSession.messages = messages;
    this.currentSession.approvedTools = approvedTools;

    if (model) {
      this.currentSession.model = model;
    }
    if (provider) {
      this.currentSession.provider = provider;
    }

    await this.saveSession(this.currentSession);
  }

  /**
   * Lists all available sessions (metadata only)
   */
  async listSessions(): Promise<SessionMeta[]> {
    if (!existsSync(this.sessionDir)) {
      return [];
    }

    const sessions: SessionMeta[] = [];

    try {
      const entries = await readdir(this.sessionDir);

      for (const entry of entries) {
        const entryPath = join(this.sessionDir, entry);
        const filePath = join(entryPath, SESSION_FILE);

        // Skip if not a directory or doesn't have session.json
        const stats = await stat(entryPath);
        if (!stats.isDirectory() || !existsSync(filePath)) {
          continue;
        }

        try {
          const content = await readFile(filePath, 'utf-8');
          const data: SessionFile = JSON.parse(content);
          sessions.push({
            id: data.session.id,
            createdAt: data.session.createdAt,
            updatedAt: data.session.updatedAt,
            messageCount: data.session.messages.length,
          });
        } catch {
          // Skip invalid session files
          continue;
        }
      }
    } catch {
      // Directory doesn't exist or can't be read
      return [];
    }

    // Sort by updatedAt descending (most recent first)
    sessions.sort((a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime());

    return sessions;
  }

  /**
   * Checks if a session exists
   */
  async sessionExists(sessionId: string): Promise<boolean> {
    const filePath = this.getSessionFilePath(sessionId);
    return existsSync(filePath);
  }
}
